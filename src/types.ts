export type UserRole = 'admin' | 'manager' | 'staff';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  departmentId?: string;
}

export interface Department {
  id: string;
  name: string;
  managerEmail: string;
  managerName: string;
  parentId?: string;
  level: number;
}

export interface Lead {
  id: string;
  creatorEmail: string;
  createdAt: string;
  assignedToEmail?: string;
  departmentId?: string;
  customerName: string;
  phone: string;
  email?: string;
  status: string;
  details?: string;
  updatedAt: string;
  updatedByEmail: string;
  imageUrl?: string;
  interestLevel?: string;
  notes?: string;
  history: string[];
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
