import { authApi } from './api-auth';
import { accountApi } from './api-account';
import { socialApi } from './api-social';
import { adminApi } from './api-admin';
import { aiApi } from './api-ai';

export const api = {
  ...authApi,
  ...accountApi,
  ...socialApi,
  ...adminApi,
  ...aiApi,
};