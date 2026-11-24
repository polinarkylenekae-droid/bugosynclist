// Polyfills for iOS Safari / older WebKit browsers (ES2024/ES2025 APIs used by pdfjs-dist & modern deps)
export const SAFARI_WORKER_POLYFILL_SOURCE = `
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}
if (typeof URL !== 'undefined' && typeof URL.parse !== 'function') {
  URL.parse = function (url, base) {
    try {
      return base !== undefined ? new URL(url, base) : new URL(url);
    } catch {
      return null;
    }
  };
}
if (typeof Map !== 'undefined') {
  if (typeof Map.prototype.getOrInsert !== 'function') {
    Object.defineProperty(Map.prototype, 'getOrInsert', {
      configurable: true,
      writable: true,
      value: function (key, defaultValue) {
        if (this.has(key)) return this.get(key);
        this.set(key, defaultValue);
        return defaultValue;
      }
    });
  }
  if (typeof Map.prototype.getOrInsertComputed !== 'function') {
    Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
      configurable: true,
      writable: true,
      value: function (key, callbackfn) {
        if (this.has(key)) return this.get(key);
        const value = callbackfn(key);
        this.set(key, value);
        return value;
      }
    });
  }
}
if (typeof WeakMap !== 'undefined') {
  if (typeof WeakMap.prototype.getOrInsert !== 'function') {
    Object.defineProperty(WeakMap.prototype, 'getOrInsert', {
      configurable: true,
      writable: true,
      value: function (key, defaultValue) {
        if (this.has(key)) return this.get(key);
        this.set(key, defaultValue);
        return defaultValue;
      }
    });
  }
  if (typeof WeakMap.prototype.getOrInsertComputed !== 'function') {
    Object.defineProperty(WeakMap.prototype, 'getOrInsertComputed', {
      configurable: true,
      writable: true,
      value: function (key, callbackfn) {
        if (this.has(key)) return this.get(key);
        const value = callbackfn(key);
        this.set(key, value);
        return value;
      }
    });
  }
}
if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout !== 'function') {
  AbortSignal.timeout = function (ms) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('The operation timed out.', 'TimeoutError')), ms);
    return controller.signal;
  };
}
`;

(function applySafariPolyfills() {
  const p = Promise as any;
  if (typeof p.withResolvers !== 'function') {
    p.withResolvers = function () {
      let resolve: any;
      let reject: any;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }

  const u = URL as any;
  if (typeof URL !== 'undefined' && typeof u.parse !== 'function') {
    u.parse = function (url: string, base?: string | URL) {
      try {
        return base !== undefined ? new URL(url, base) : new URL(url);
      } catch {
        return null;
      }
    };
  }

  const mapProto = Map.prototype as any;
  if (typeof mapProto.getOrInsert !== 'function') {
    Object.defineProperty(mapProto, 'getOrInsert', {
      configurable: true,
      writable: true,
      value: function <K, V>(this: Map<K, V>, key: K, defaultValue: V): V {
        if (this.has(key)) return this.get(key) as V;
        this.set(key, defaultValue);
        return defaultValue;
      },
    });
  }
  if (typeof mapProto.getOrInsertComputed !== 'function') {
    Object.defineProperty(mapProto, 'getOrInsertComputed', {
      configurable: true,
      writable: true,
      value: function <K, V>(this: Map<K, V>, key: K, callbackfn: (key: K) => V): V {
        if (this.has(key)) return this.get(key) as V;
        const value = callbackfn(key);
        this.set(key, value);
        return value;
      },
    });
  }

  const weakMapProto = WeakMap.prototype as any;
  if (typeof weakMapProto.getOrInsert !== 'function') {
    Object.defineProperty(weakMapProto, 'getOrInsert', {
      configurable: true,
      writable: true,
      value: function <K extends object, V>(this: WeakMap<K, V>, key: K, defaultValue: V): V {
        if (this.has(key)) return this.get(key) as V;
        this.set(key, defaultValue);
        return defaultValue;
      },
    });
  }
  if (typeof weakMapProto.getOrInsertComputed !== 'function') {
    Object.defineProperty(weakMapProto, 'getOrInsertComputed', {
      configurable: true,
      writable: true,
      value: function <K extends object, V>(this: WeakMap<K, V>, key: K, callbackfn: (key: K) => V): V {
        if (this.has(key)) return this.get(key) as V;
        const value = callbackfn(key);
        this.set(key, value);
        return value;
      },
    });
  }

  const abortSig = AbortSignal as any;
  if (typeof AbortSignal !== 'undefined' && typeof abortSig.timeout !== 'function') {
    abortSig.timeout = function (ms: number) {
      const controller = new AbortController();
      setTimeout(() => {
        try {
          controller.abort(new DOMException('The operation timed out.', 'TimeoutError'));
        } catch {
          controller.abort();
        }
      }, ms);
      return controller.signal;
    };
  }
})();
