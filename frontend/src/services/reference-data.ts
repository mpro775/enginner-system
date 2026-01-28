import api from './api';
import { ApiResponse, Location, Department, System, Machine } from '@/types';

// Locations
export const locationsService = {
  async getAll(activeOnly = true): Promise<Location[]> {
    const response = await api.get<ApiResponse<Location[]>>('/locations', {
      params: { all: !activeOnly },
    });
    return response.data.data;
  },

  async getById(id: string): Promise<Location> {
    const response = await api.get<ApiResponse<Location>>(`/locations/${id}`);
    return response.data.data;
  },

  async create(data: Partial<Location>): Promise<Location> {
    const response = await api.post<ApiResponse<Location>>('/locations', data);
    return response.data.data;
  },

  async update(id: string, data: Partial<Location>): Promise<Location> {
    const response = await api.patch<ApiResponse<Location>>(`/locations/${id}`, data);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/locations/${id}`);
  },

  async toggleStatus(id: string, currentStatus: boolean): Promise<Location> {
    const response = await api.patch<ApiResponse<Location>>(`/locations/${id}`, {
      isActive: !currentStatus,
    });
    return response.data.data;
  },

  async softDelete(id: string): Promise<void> {
    await api.delete(`/locations/${id}`);
  },

  async hardDelete(id: string): Promise<void> {
    await api.delete(`/locations/${id}/hard`);
  },

  async restore(id: string): Promise<Location> {
    const response = await api.post<ApiResponse<Location>>(`/locations/${id}/restore`);
    return response.data.data;
  },

  async getDeleted(): Promise<Location[]> {
    const response = await api.get<ApiResponse<Location[]>>('/locations/trash');
    return response.data.data;
  },
};

// Departments
export const departmentsService = {
  async getAll(activeOnly = true): Promise<Department[]> {
    const response = await api.get<ApiResponse<Department[]>>('/departments', {
      params: { all: !activeOnly },
    });
    return response.data.data;
  },

  async getById(id: string): Promise<Department> {
    const response = await api.get<ApiResponse<Department>>(`/departments/${id}`);
    return response.data.data;
  },

  async create(data: Partial<Department>): Promise<Department> {
    const response = await api.post<ApiResponse<Department>>('/departments', data);
    return response.data.data;
  },

  async update(id: string, data: Partial<Department>): Promise<Department> {
    const response = await api.patch<ApiResponse<Department>>(`/departments/${id}`, data);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/departments/${id}`);
  },

  async toggleStatus(id: string, currentStatus: boolean): Promise<Department> {
    const response = await api.patch<ApiResponse<Department>>(`/departments/${id}`, {
      isActive: !currentStatus,
    });
    return response.data.data;
  },

  async softDelete(id: string): Promise<void> {
    await api.delete(`/departments/${id}`);
  },

  async hardDelete(id: string): Promise<void> {
    await api.delete(`/departments/${id}/hard`);
  },

  async restore(id: string): Promise<Department> {
    const response = await api.post<ApiResponse<Department>>(`/departments/${id}/restore`);
    return response.data.data;
  },

  async getDeleted(): Promise<Department[]> {
    const response = await api.get<ApiResponse<Department[]>>('/departments/trash');
    return response.data.data;
  },
};

// Systems
export const systemsService = {
  async getAll(activeOnly = true): Promise<System[]> {
    const response = await api.get<ApiResponse<System[]>>('/systems', {
      params: { all: !activeOnly },
    });
    return response.data.data;
  },

  async getById(id: string): Promise<System> {
    const response = await api.get<ApiResponse<System>>(`/systems/${id}`);
    return response.data.data;
  },

  async create(data: Partial<System>): Promise<System> {
    const response = await api.post<ApiResponse<System>>('/systems', data);
    return response.data.data;
  },

  async update(id: string, data: Partial<System>): Promise<System> {
    const response = await api.patch<ApiResponse<System>>(`/systems/${id}`, data);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/systems/${id}`);
  },

  async toggleStatus(id: string, currentStatus: boolean): Promise<System> {
    const response = await api.patch<ApiResponse<System>>(`/systems/${id}`, {
      isActive: !currentStatus,
    });
    return response.data.data;
  },

  async softDelete(id: string): Promise<void> {
    await api.delete(`/systems/${id}`);
  },

  async hardDelete(id: string): Promise<void> {
    await api.delete(`/systems/${id}/hard`);
  },

  async restore(id: string): Promise<System> {
    const response = await api.post<ApiResponse<System>>(`/systems/${id}/restore`);
    return response.data.data;
  },

  async getDeleted(): Promise<System[]> {
    const response = await api.get<ApiResponse<System[]>>('/systems/trash');
    return response.data.data;
  },

  async getByDepartment(departmentId: string, activeOnly = true): Promise<System[]> {
    const response = await api.get<ApiResponse<System[]>>(`/systems/by-department/${departmentId}`, {
      params: { all: !activeOnly },
    });
    return response.data.data;
  },
};

// Machines
export const machinesService = {
  async getAll(activeOnly = true): Promise<Machine[]> {
    const response = await api.get<ApiResponse<Machine[]>>('/machines', {
      params: { all: !activeOnly },
    });
    return response.data.data;
  },

  async getBySystem(systemId: string, activeOnly = true): Promise<Machine[]> {
    const response = await api.get<ApiResponse<Machine[]>>(`/machines/by-system/${systemId}`, {
      params: { all: !activeOnly },
    });
    return response.data.data;
  },

  async getById(id: string): Promise<Machine> {
    const response = await api.get<ApiResponse<Machine>>(`/machines/${id}`);
    return response.data.data;
  },

  async create(data: Partial<Machine>): Promise<Machine> {
    const response = await api.post<ApiResponse<Machine>>('/machines', data);
    return response.data.data;
  },

  async update(id: string, data: Partial<Machine>): Promise<Machine> {
    const response = await api.patch<ApiResponse<Machine>>(`/machines/${id}`, data);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/machines/${id}`);
  },

  async toggleStatus(id: string, currentStatus: boolean): Promise<Machine> {
    const response = await api.patch<ApiResponse<Machine>>(`/machines/${id}`, {
      isActive: !currentStatus,
    });
    return response.data.data;
  },

  async softDelete(id: string): Promise<void> {
    await api.delete(`/machines/${id}`);
  },

  async hardDelete(id: string): Promise<void> {
    await api.delete(`/machines/${id}/hard`);
  },

  async restore(id: string): Promise<Machine> {
    const response = await api.post<ApiResponse<Machine>>(`/machines/${id}/restore`);
    return response.data.data;
  },

  async getDeleted(): Promise<Machine[]> {
    const response = await api.get<ApiResponse<Machine[]>>('/machines/trash');
    return response.data.data;
  },
};



