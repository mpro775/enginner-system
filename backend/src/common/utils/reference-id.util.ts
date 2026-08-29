/**
 * Normalizes a String/ObjectId aggregation value to ObjectId for reference joins.
 * Invalid legacy values are preserved so their statistical row can still be shown
 * with an explicit unresolved-reference label.
 */
export function normalizedReferenceIdExpression(input: unknown) {
  return {
    $convert: {
      input,
      to: "objectId",
      onError: input,
      onNull: input,
    },
  };
}
