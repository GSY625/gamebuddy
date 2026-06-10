import { authApi } from './api-auth';
import { accountApi } from './api-account';
import { socialApi } from './api-social';
import { adminApi } from './api-admin';

export const api = {
  ...authApi,
  ...accountApi,
  ...socialApi,
  ...adminApi,
};
