import {
  triggerWorkflow as dispatchWorkflow,
  type WorkflowDispatchOptions,
} from "./github/workflow-dispatcher";

export { triggerWorkflow as dispatchWorkflow } from "./github/workflow-dispatcher";
export type { WorkflowDispatchOptions } from "./github/workflow-dispatcher";

export async function triggerWorkflow(
  owner: string,
  repo: string,
  workflowId: string,
  ref: string,
  token: string
) {
  const options: WorkflowDispatchOptions = {
    owner,
    repo,
    workflowId,
    ref,
    token,
  };
  return dispatchWorkflow(options);
}
