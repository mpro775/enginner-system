#!/usr/bin/env python3
"""
Restore February 2026 maintenance data from legacy PDF reports.

What this script does:
1) Parses all EM-202602-*.pdf files (single-request emergency reports).
2) Parses the monthly preventive report (PM-202602-xxxx rows).
3) Rebuilds minimal reference data (engineer, locations, departments, systems, machines).
4) Upserts maintenance requests by requestCode (idempotent).

Run:
  python backend/scripts/restore_feb_2026_from_reports.py
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from dotenv import load_dotenv
import fitz
from pymongo import MongoClient, ReturnDocument
import bcrypt
import os


ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
REPORTS_DIR = ROOT / "تقارير قديمة"


ENGINEER_NAME = "الخضر بابطاط"
ENGINEER_EMAIL = "eng.khader.babtat@restored.local"
ENGINEER_PASSWORD = "Eng@2026#"


KNOWN_PM_CODES = {
    "PM-202602-0001",
    "PM-202602-0002",
    "PM-202602-0003",
    "PM-202602-0004",
    "PM-202602-0007",
    "PM-202602-0008",
    "PM-202602-0009",
    "PM-202602-0010",
    "PM-202602-0011",
    "PM-202602-0017",
    "PM-202602-0018",
    "PM-202602-0019",
    "PM-202602-0029",
    "PM-202602-0030",
    "PM-202602-0031",
    "PM-202602-0032",
    "PM-202602-0039",
    "PM-202602-0040",
    "PM-202602-0041",
    "PM-202602-0042",
    "PM-202602-0048",
    "PM-202602-0049",
    "PM-202602-0050",
    "PM-202602-0051",
    "PM-202602-0052",
    "PM-202602-0057",
    "PM-202602-0066",
    "PM-202602-0067",
    "PM-202602-0068",
    "PM-202602-0073",
    "PM-202602-0074",
    "PM-202602-0075",
    "PM-202602-0077",
    "PM-202602-0078",
    "PM-202602-0083",
    "PM-202602-0093",
    "PM-202602-0094",
    "PM-202602-0095",
    "PM-202602-0097",
    "PM-202602-0098",
    "PM-202602-0100",
}


ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


@dataclass
class ParsedRequest:
    request_code: str
    maintenance_type: str
    status: str
    opened_at: datetime
    location_name: str
    department_name: str
    system_name: str
    machine_name: str
    reason_text: str
    engineer_name: str
    machine_number: Optional[str] = None
    request_needs: Optional[str] = None
    closed_at: Optional[datetime] = None
    stopped_at: Optional[datetime] = None
    stop_reason: Optional[str] = None


def normalize_digits(text: str) -> str:
    return text.translate(ARABIC_DIGITS)


def squash_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def has_arabic(text: str) -> bool:
    return bool(re.search(r"[\u0600-\u06FF]", text))


def keep_arabic_side(value: str) -> str:
    value = squash_spaces(value)
    if not value:
        return value
    if "/" not in value:
        return value
    parts = [squash_spaces(p) for p in value.split("/") if squash_spaces(p)]
    if not parts:
        return value
    arabic_parts = [p for p in parts if has_arabic(p)]
    if arabic_parts:
        return max(arabic_parts, key=len)
    return parts[0]


def clean_value(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.replace("\u200f", " ").replace("\u200e", " ").replace("￾", "")
    value = squash_spaces(value)
    value = keep_arabic_side(value)
    return value or None


def normalize_name(name: str) -> str:
    name = squash_spaces(name)
    replacements = {
        "الهندسة كلية": "كلية الهندسة",
        "االلي الحاسب كلية": "كلية الحاسب الآلي",
        "الحاسب كلية": "كلية الحاسب الآلي",
        "الخارجية المساحات": "المساحات الخارجية",
        "الورش": "الورش",
        "التدريس هيئة أعضاء إسكان خدمات مبنى": "مبنى خدمات إسكان أعضاء هيئة التدريس",
        "كلية الحاسب االلي": "كلية الحاسب الآلي",
        "كلية الحاسب الالي": "كلية الحاسب الآلي",
        "كلية الحاسب": "كلية الحاسب الآلي",
        "الميكانيك": "ميكانيكا",
        "ميكانيك": "ميكانيكا",
        "االمن والسلامة": "الأمن والسلامة",
        "امن وسلامة": "الأمن والسلامة",
        "التكييف/conditioning air": "التكييف",
        "الحريق/fire": "الحريق",
    }
    return replacements.get(name, name)


def extract_pdf_text(pdf_path: Path) -> str:
    doc = fitz.open(str(pdf_path))
    parts: List[str] = []
    for page in doc:
        parts.append(page.get_text() or "")
    doc.close()
    return "\n".join(parts)


def parse_date_string(raw: str) -> Optional[datetime]:
    if not raw:
        return None
    raw = normalize_digits(raw).replace("\u200f", "").strip("/ ")
    parts = raw.split("/")
    if len(parts) != 3:
        return None

    y, m, d = parts

    def maybe_reverse(num: str, upper: int) -> str:
        try:
            n = int(num)
        except ValueError:
            return num
        if n <= upper:
            return num
        rev = num[::-1]
        try:
            rv = int(rev)
        except ValueError:
            return num
        return rev if rv <= upper else num

    y = maybe_reverse(y, 2100)
    m = maybe_reverse(m, 12)
    d = maybe_reverse(d, 31)

    try:
        return datetime(int(y), int(m), int(d), 8, 0, 0)
    except ValueError:
        return None


def date_after_label(text: str, labels: List[str]) -> Optional[datetime]:
    normalized = normalize_digits(text)
    for label in labels:
        pattern = rf"{label}\s*([0-9]{{4}}/[0-9]{{1,2}}/[0-9]{{1,2}})"
        m = re.search(pattern, normalized)
        if m:
            parsed = parse_date_string(m.group(1))
            if parsed:
                return parsed
    return None


def extract_single_line_value(text: str, labels: List[str]) -> Optional[str]:
    for label in labels:
        pattern = rf"{label}\s*([^\n]+)"
        m = re.search(pattern, text)
        if m:
            value = clean_value(m.group(1))
            if value:
                return value
    return None


def extract_value_until(text: str, labels: List[str], end_labels: List[str]) -> Optional[str]:
    for label in labels:
        for end_label in end_labels:
            pattern = rf"{label}\s*(.*?)\s*{end_label}"
            m = re.search(pattern, text, flags=re.DOTALL)
            if m:
                lines = [squash_spaces(x) for x in m.group(1).splitlines() if squash_spaces(x)]
                if lines:
                    return clean_value(lines[0])
    return None


def extract_block(text: str, start_label: str, end_label: str) -> Optional[str]:
    pattern = rf"{start_label}\s*(.*?)\s*{end_label}"
    m = re.search(pattern, text, flags=re.DOTALL)
    if not m:
        return None
    value = clean_value(m.group(1))
    if not value:
        return None
    return value


def parse_em_report(pdf_path: Path) -> ParsedRequest:
    text = extract_pdf_text(pdf_path)
    code = pdf_path.stem

    opened = date_after_label(text, ["تاريخ الفتح", "الفتح تاريخ"])
    if not opened:
        raise ValueError(f"Could not parse opened date for {code}")

    status_raw = extract_single_line_value(text, ["الحالة"]) or "مكتملة"
    if "متوق" in status_raw:
        status = "stopped"
    elif "قيد" in status_raw:
        status = "in_progress"
    else:
        status = "completed"

    closed = date_after_label(text, ["تاريخ الإغلاق", "تاريخ اإلغالق", "الإغلاق تاريخ", "االغالق تاريخ"])
    stopped = date_after_label(text, ["تاريخ التوقف", "التوقف تاريخ"])

    location = normalize_name(
        extract_single_line_value(text, ["الموقع"]) or "غير محدد من التقرير"
    )
    department = normalize_name(
        extract_single_line_value(text, ["القسم"]) or "غير محدد من التقرير"
    )
    system = normalize_name(
        extract_single_line_value(text, ["الفرع"]) or "غير محدد من التقرير"
    )
    machine = normalize_name(
        extract_single_line_value(text, ["البند"]) or "غير محدد من التقرير"
    )
    machine_number = extract_value_until(
        text,
        ["رقم/توصيف البند", "البند توصيف/رقم"],
        ["وصف الطلب", "الطلب وصف"],
    )
    reason = (
        extract_block(text, "وصف الطلب", "معلومات مباشرة العمل")
        or extract_block(text, "الطلب وصف", "العمل مباشرة معلومات")
        or ""
    )
    engineer = ENGINEER_NAME
    request_needs = extract_single_line_value(text, ["احتياجات الطلب", "الطلب احتياجات"])
    stop_reason = (
        extract_block(text, "سبب التوقف", "مالحظات")
        or extract_block(text, "التوقف سبب", "مالحظات")
        or extract_block(text, "سبب التوقف", "حالة الطلب")
        or extract_block(text, "التوقف سبب", "الطلب حالة")
    )

    if status == "completed" and not closed:
        closed = opened
    if status == "stopped" and not stopped:
        stopped = opened

    return ParsedRequest(
        request_code=code,
        maintenance_type="emergency",
        status=status,
        opened_at=opened,
        closed_at=closed,
        stopped_at=stopped,
        stop_reason=stop_reason,
        location_name=location,
        department_name=department,
        system_name=system,
        machine_name=machine,
        machine_number=machine_number,
        reason_text=reason or "طلب مسترجع من تقرير طارئ",
        engineer_name=engineer,
        request_needs=request_needs,
    )


def strip_latin(text: str) -> str:
    text = re.sub(r"[A-Za-z]", " ", text)
    return squash_spaces(text)


def infer_pm_fields(reason_text: str) -> tuple[str, str, str]:
    low = reason_text.lower()
    ar = reason_text
    if "fcu" in low or "fcu" in ar:
        return "ميكانيكا", "التكييف", "وحدات FCU"
    if "ahu" in low or "ahu" in ar:
        return "ميكانيكا", "التكييف", "وحدات AHU"
    if "مراوح" in ar or "fan" in low:
        return "ميكانيكا", "التهوية", "مراوح تهوية"
    if "محوال" in ar or "محول" in ar or "rmu" in low:
        return "كهرباء", "كهرباء", "محول كهربائي"
    if "مضخ" in ar:
        if "حريق" in ar:
            return "ميكانيكا", "الحريق", "مضخة حريق"
        return "ميكانيكا", "المياه", "مضخة"
    if "كاشف" in ar or "حساس" in ar or "إنذار" in ar or "انذار" in ar:
        return "كهرباء", "الأمن والسلامة", "أنظمة إنذار وكشف"
    if "لمبات" in ar or "إنارة" in ar or "انارة" in ar:
        return "كهرباء", "كهرباء", "إنارة"
    return "ميكانيكا", "وقائي عام", "أعمال وقائية مجمعة"


def extract_pm_reason(chunk: str) -> str:
    lines = [squash_spaces(l) for l in chunk.splitlines() if squash_spaces(l)]
    blacklist = (
        "السالمة",
        "very important",
        "following safety",
        "task description",
        "work tasks",
        "المملكة العربية السعودية",
        "جامعة الملك سعود",
        "نائب رئيس الجامعة",
        "الإدارة العامة",
        "rgsa",
        "www.",
        "hm@",
        "هاتف",
    )
    good: List[str] = []
    for line in lines:
        l = line.lower()
        if any(b in l for b in blacklist):
            continue
        if len(line) < 3:
            continue
        good.append(line)
        if len(" ".join(good)) > 120:
            break
    if not good:
        return "طلب وقائي مسترجع من التقرير المجمع"
    return squash_spaces(" ".join(good[:2]))


def parse_pm_monthly_report(pdf_path: Path) -> List[ParsedRequest]:
    text = extract_pdf_text(pdf_path)
    text = normalize_digits(text).replace("\u200f", " ").replace("\u200e", " ")
    text = text.replace("￾", "")

    row_pattern = re.compile(
        r"(?P<date>[0-9]{4}/[0-9]{1,2}/[0-9]{1,2})\s+"
        r"/?\s*(?P<location>.+?)\s+"
        r"مكتملة\s+وقائية\s+الخضر\s+بابطاط\s+"
        r"PM[^0-9]{0,30}202602[-\s]*(?P<seq>[0-9]{4})",
        flags=re.DOTALL,
    )

    matches = list(row_pattern.finditer(text))
    parsed: Dict[str, ParsedRequest] = {}

    for i, m in enumerate(matches):
        seq = m.group("seq")
        code = f"PM-202602-{seq}"

        opened = parse_date_string(m.group("date")) or datetime(2026, 2, 1, 8, 0, 0)

        location_raw = squash_spaces(m.group("location"))
        location_raw = strip_latin(location_raw)
        location_raw = keep_arabic_side(location_raw)
        location = normalize_name(location_raw or "غير محدد من التقرير")

        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        reason_chunk = text[m.end() : end]
        reason = extract_pm_reason(reason_chunk)

        department, system, machine = infer_pm_fields(reason)

        parsed[code] = ParsedRequest(
            request_code=code,
            maintenance_type="preventive",
            status="completed",
            opened_at=opened,
            closed_at=opened,
            location_name=location,
            department_name=department,
            system_name=system,
            machine_name=machine,
            reason_text=reason,
            engineer_name=ENGINEER_NAME,
        )

    for code in sorted(KNOWN_PM_CODES):
        if code in parsed:
            continue
        fallback_reason = "بيانات مسترجعة من تقرير الوقائية المجمع لشهر فبراير"
        department, system, machine = infer_pm_fields(fallback_reason)
        parsed[code] = ParsedRequest(
            request_code=code,
            maintenance_type="preventive",
            status="completed",
            opened_at=datetime(2026, 2, 1, 8, 0, 0),
            closed_at=datetime(2026, 2, 1, 8, 0, 0),
            location_name="غير محدد من التقرير المجمع",
            department_name=department,
            system_name=system,
            machine_name=machine,
            reason_text=fallback_reason,
            engineer_name=ENGINEER_NAME,
        )

    return [parsed[k] for k in sorted(parsed.keys())]


def upsert_named_document(collection, name: str, extra_fields: Optional[dict] = None):
    now = datetime.utcnow()
    extra_fields = extra_fields or {}
    update_set = {
        "name": name,
        "isActive": True,
        "deletedAt": None,
        "updatedAt": now,
        **extra_fields,
    }
    doc = collection.find_one_and_update(
        {"name": name},
        {"$set": update_set, "$setOnInsert": {"createdAt": now}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return doc


def upsert_machine(collection, name: str, system_id, description: str = ""):
    now = datetime.utcnow()
    doc = collection.find_one_and_update(
        {"name": name, "systemId": system_id},
        {
            "$set": {
                "name": name,
                "systemId": system_id,
                "description": description,
                "components": [],
                "isActive": True,
                "deletedAt": None,
                "updatedAt": now,
            },
            "$setOnInsert": {"createdAt": now},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return doc


def main() -> int:
    load_dotenv(BACKEND_DIR / ".env")
    load_dotenv(ROOT / ".env")
    mongodb_uri = os.getenv("MONGODB_URI")
    if not mongodb_uri:
        print("ERROR: MONGODB_URI is not set in environment or backend/.env")
        return 1

    if not REPORTS_DIR.exists():
        print(f"ERROR: Reports folder does not exist: {REPORTS_DIR}")
        return 1

    em_files = sorted(REPORTS_DIR.glob("EM-202602-*.pdf"))
    monthly_files = [p for p in REPORTS_DIR.glob("*.pdf") if not p.name.startswith("EM-")]
    if not em_files:
        print("ERROR: No EM-202602-*.pdf files found")
        return 1
    if not monthly_files:
        print("ERROR: Monthly preventive report PDF not found")
        return 1

    monthly_file = monthly_files[0]

    print(f"Found {len(em_files)} emergency PDFs")
    print(f"Monthly preventive report: {monthly_file.name}")

    em_requests = [parse_em_report(p) for p in em_files]
    pm_requests = parse_pm_monthly_report(monthly_file)
    all_requests = em_requests + pm_requests

    client = MongoClient(mongodb_uri)
    db = client.get_default_database()

    users = db["users"]
    locations = db["locations"]
    departments = db["departments"]
    systems = db["systems"]
    machines = db["machines"]
    requests = db["maintenancerequests"]

    password_hash = bcrypt.hashpw(
        ENGINEER_PASSWORD.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")

    default_dept_doc = upsert_named_document(departments, "ميكانيكا")
    engineer_doc = users.find_one_and_update(
        {"email": ENGINEER_EMAIL.lower()},
        {
            "$set": {
                "name": ENGINEER_NAME,
                "email": ENGINEER_EMAIL.lower(),
                "password": password_hash,
                "role": "engineer",
                "departmentIds": [default_dept_doc["_id"]],
                "isActive": True,
                "deletedAt": None,
                "updatedAt": datetime.utcnow(),
            },
            "$setOnInsert": {"createdAt": datetime.utcnow()},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    location_id_map: Dict[str, object] = {}
    department_id_map: Dict[str, object] = {}
    system_id_map: Dict[str, object] = {}
    machine_id_map: Dict[tuple, object] = {}

    unique_locations = sorted({normalize_name(r.location_name) for r in all_requests})
    unique_departments = sorted({normalize_name(r.department_name) for r in all_requests})
    unique_systems = sorted({normalize_name(r.system_name) for r in all_requests})

    for loc in unique_locations:
        doc = upsert_named_document(locations, loc)
        location_id_map[loc] = doc["_id"]

    for dept in unique_departments:
        doc = upsert_named_document(departments, dept)
        department_id_map[dept] = doc["_id"]

    for system_name in unique_systems:
        doc = upsert_named_document(systems, system_name)
        system_id_map[system_name] = doc["_id"]

    for req in all_requests:
        system_name = normalize_name(req.system_name)
        machine_name = normalize_name(req.machine_name)
        key = (machine_name, system_name)
        if key in machine_id_map:
            continue
        machine_doc = upsert_machine(
            machines,
            machine_name,
            system_id_map[system_name],
            description="Recovered from February 2026 reports",
        )
        machine_id_map[key] = machine_doc["_id"]

    inserted_or_updated = 0
    created = 0
    updated = 0

    for req in all_requests:
        location_name = normalize_name(req.location_name)
        department_name = normalize_name(req.department_name)
        system_name = normalize_name(req.system_name)
        machine_name = normalize_name(req.machine_name)

        opened_at = req.opened_at
        closed_at = req.closed_at
        stopped_at = req.stopped_at

        doc = {
            "requestCode": req.request_code,
            "engineerId": engineer_doc["_id"],
            "maintenanceType": req.maintenance_type,
            "locationId": location_id_map[location_name],
            "departmentId": department_id_map[department_name],
            "systemId": system_id_map[system_name],
            "machineId": machine_id_map[(machine_name, system_name)],
            "reasonText": req.reason_text,
            "machineNumber": req.machine_number,
            "requestNeeds": req.request_needs,
            "status": req.status,
            "engineerNotes": None,
            "consultantNotes": None,
            "healthSafetyNotes": None,
            "projectManagerNotes": None,
            "stopReason": req.stop_reason,
            "implementedWork": None,
            "maintainAllComponents": True,
            "selectedComponents": [],
            "openedAt": opened_at,
            "closedAt": closed_at,
            "stoppedAt": stopped_at,
            "scheduledTaskId": None,
            "complaintId": None,
            "deletedAt": None,
            "deletedBy": None,
            "updatedAt": datetime.utcnow(),
        }

        existing = requests.find_one({"requestCode": req.request_code}, {"_id": 1})
        requests.update_one(
            {"requestCode": req.request_code},
            {
                "$set": doc,
                "$setOnInsert": {
                    "createdAt": opened_at,
                },
            },
            upsert=True,
        )

        inserted_or_updated += 1
        if existing:
            updated += 1
        else:
            created += 1

    client.close()

    print("\nRestore completed successfully")
    print(f"- Emergency requests parsed: {len(em_requests)}")
    print(f"- Preventive requests parsed: {len(pm_requests)}")
    print(f"- Total requests processed: {inserted_or_updated}")
    print(f"- Created requests: {created}")
    print(f"- Updated requests: {updated}")
    print(f"- Engineer account: {ENGINEER_EMAIL}")
    print(f"- Engineer password: {ENGINEER_PASSWORD}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
