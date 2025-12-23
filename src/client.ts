import { cloudstudio } from "tencentcloud-sdk-nodejs-cloudstudio";
import { SECRET_ID, SECRET_KEY } from "./env";

// 创建客户端对象
export const client = new cloudstudio.v20230508.Client({
  credential: {
    secretId: SECRET_ID,
    secretKey: SECRET_KEY,
  },
  region: "ap-shanghai",
});
