const path = require('path');
const moduleProto = require('module').Module.prototype;
const originalRequire = moduleProto.require;

// Intercept path aliases
moduleProto.require = function (request) {
  if (request.startsWith('@/')) {
    const relativePart = request.slice(2);
    const absolutePath = path.resolve(__dirname, '../dist/src', relativePart);
    return originalRequire.call(this, absolutePath);
  }
  return originalRequire.call(this, request);
};

// Polyfill minimal browser DOM globals for Node.js testing context using standard ES Proxy
global.document = {
  getElementById: () => null, // Safe return for ReportEngine layer checks
  createElement: function (tagName) {
    if (tagName === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: function () {
          const mockCtx = {
            createRadialGradient: () => {
              return { addColorStop: () => {} };
            },
            createLinearGradient: () => {
              return { addColorStop: () => {} };
            },
            measureText: () => {
              return { width: 100 };
            }
          };
          
          // Return an immune Canvas Context Proxy that handles any method call gracefully
          return new Proxy(mockCtx, {
            get(target, prop) {
              if (prop in target) {
                return target[prop];
              }
              return () => {}; // Graceful no-op fallback for fillRect, strokeRect, drawImage, etc.
            }
          });
        },
        toDataURL: function () {
          return "data:image/png;base64,mockDataUrl";
        }
      };
    }
    return {};
  }
};

global.Image = class {
  constructor() {
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 5);
  }
};

// Now execute the compiled tests entrypoint
try {
  require('../dist/scratch/runIICMigrationTests.js');
} catch (error) {
  console.error("❌ ERROR CRÍTICO AL EJECUTAR LOS TESTS:", error);
  process.exit(1);
}
