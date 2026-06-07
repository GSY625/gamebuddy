import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export type RequestContextState = {
  requestId: string;
  method?: string;
  path?: string;
  ip?: string;
  userId?: string;
  handler?: string;
};

@Injectable()
export class RequestContextService {
  private storage = new AsyncLocalStorage<RequestContextState>();

  run<T>(state: RequestContextState, callback: () => T) {
    return this.storage.run(state, callback);
  }

  get() {
    return this.storage.getStore();
  }

  getRequestId() {
    return this.get()?.requestId;
  }

  set(partial: Partial<RequestContextState>) {
    const current = this.get();
    if (!current) return;
    Object.assign(current, partial);
  }
}
