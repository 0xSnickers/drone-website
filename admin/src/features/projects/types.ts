export interface Project {
  id: string;
  name: string;
  appKey: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  name: string;
  description?: string;
}
