export interface SuccessResponse {
  success: true;
  timestamp: string;
  message: string;
  repo: string;
  workflowFile: string;
  branch?: string;
  workflowId?: string;
}

export interface ErrorResponse {
  success: false;
  timestamp: string;
  error: string;
  config: {
    repo: string;
    workflowFile: string;
    branch?: string;
  };
}
