export type Role = "USER" | "ADMIN" | "SUPERADMIN";

export interface IUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedUsersResponse {
  users: IUser[];
  currentPage: number;
  totalPages: number;
  totalUsers: number;
}
