export interface IPlan {
  name: string;
  description?: string;
  resources: {
    requests?: {
      cpu?: string;
      memory?: string;
    };
    limits?: {
      cpu?: string;
      memory?: string;
    };
  };
  isDefault?: boolean;
  price?: number;
  isActive?: boolean;
}
