import { cloudstudio } from "tencentcloud-sdk-nodejs-cloudstudio";
import type { CloudStudioConfig } from "../config/runtime-env";

export type CloudStudioClient = InstanceType<
  typeof cloudstudio.v20230508.Client
>;

export function createCloudStudioClient(config: CloudStudioConfig) {
  return new cloudstudio.v20230508.Client({
    credential: {
      secretId: config.secretId,
      secretKey: config.secretKey,
    },
    region: "ap-shanghai",
  });
}
