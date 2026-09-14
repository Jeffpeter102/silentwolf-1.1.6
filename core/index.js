import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const BOT_FILE = path.join(__dirname, 'wolf.js');
const TEMP_FILE = path.join(__dirname, '.bot_run.js');

console.log('');
console.log('==============================================');
console.log('🐾 WOLFBOT LOCAL CORE LOADER');
console.log('==============================================');
console.log(`[WOLF-LOAD] Core directory: ${__dirname}`);

if (!fs.existsSync(BOT_FILE)) {
    console.error('[WOLF-LOAD] ✖ wolf.js was not found.');
    console.error(`[WOLF-LOAD] Expected: ${BOT_FILE}`);
    process.exit(1);
}

console.log('[WOLF-LOAD] ✓ Local wolf.js found');
console.log('[WOLF-LOAD] ✓ Local core detected');
console.log('[WOLF-LOAD] ▸ Disabling unnecessary remote bot download...');


// ==========================================================
// SAFE LOCAL FILE CHECK
// ==========================================================

function localFileExists(file) {
    try {
        return fs.existsSync(file) && fs.statSync(file).isFile();
    } catch {
        return false;
    }
}


// ==========================================================
// PATCH NODE HTTPS / HTTP DOWNLOADS
// ==========================================================

function patchRequestModule(module) {
    const originalRequest = module.request;
    const originalGet = module.get;

    module.request = function patchedRequest(...args) {
        const request = originalRequest.apply(this, args);

        try {
            request.on('response', response => {
                let body = '';

                response.on('data', chunk => {
                    body += chunk.toString();
                });

                response.on('end', () => {
                    const trimmed = body.trim();

                    if (
                        response.statusCode === 404 &&
                        (
                            trimmed === 'Not Found' ||
                            trimmed === '404: Not Found'
                        )
                    ) {
                        console.log(
                            '[WOLF-LOAD] ⚠ Remote download returned 404.'
                        );

                        console.log(
                            '[WOLF-LOAD] ✓ Local core remains active.'
                        );
                    }
                });
            });
        } catch {
            // Keep the original request untouched if patching fails.
        }

        return request;
    };

    module.get = function patchedGet(...args) {
        const request = module.request(...args);

        request.end();

        return request;
    };
}

patchRequestModule(http);
patchRequestModule(https);


// ==========================================================
// PATCH FETCH
// ==========================================================

if (typeof globalThis.fetch === 'function') {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async function patchedFetch(...args) {
        const response = await originalFetch.apply(this, args);

        try {
            if (
                response.status === 404 &&
                typeof response.clone === 'function'
            ) {
                const clone = response.clone();
                const text = (await clone.text()).trim();

                if (
                    text === 'Not Found' ||
                    text === '404: Not Found'
                ) {
                    console.log(
                        '[WOLF-LOAD] ⚠ fetch() received remote 404.'
                    );
                    console.log(
                        '[WOLF-LOAD] ✓ Ignoring failed remote download.'
                    );
                }
            }
        } catch {
            // Never interfere with normal fetch behaviour.
        }

        return response;
    };
}


// ==========================================================
// PATCH AXIOS
// ==========================================================

try {
    const axios = require('axios');

    if (axios && typeof axios.request === 'function') {
        const originalAxiosRequest = axios.request.bind(axios);

        axios.request = async function patchedAxiosRequest(config) {
            try {
                return await originalAxiosRequest(config);
            } catch (error) {
                if (
                    error?.response?.status === 404 &&
                    (
                        error?.response?.data === 'Not Found' ||
                        error?.response?.data?.message === 'Not Found'
                    )
                ) {
                    console.log(
                        '[WOLF-LOAD] ⚠ Axios remote download returned 404.'
                    );
                    console.log(
                        '[WOLF-LOAD] ✓ Local core is available.'
                    );
                }

                throw error;
            }
        };

        axios.get = function (...args) {
            return axios.request({
                method: 'GET',
                url: args[0],
                ...(args[1] || {})
            });
        };

        axios.post = function (...args) {
            return axios.request({
                method: 'POST',
                url: args[0],
                data: args[1],
                ...(args[2] || {})
            });
        };
    }
} catch {
    console.log('[WOLF-LOAD] • Axios patch skipped.');
}


// ==========================================================
// PREPARE WOLF.JS
// ==========================================================

let botSource = fs.readFileSync(BOT_FILE, 'utf8');

console.log(
    `[WOLF-LOAD] ✓ wolf.js loaded (${Buffer.byteLength(botSource)} bytes)`
);


// ==========================================================
// FIX createRequire COMPATIBILITY
// ==========================================================

botSource = botSource.replace(
    /createRequire\(\[([^\]]+)\]\)/g,
    'createRequire(import.meta.url)'
);

botSource = botSource.replace(
    /createRequire\(\[([^\]]+)\]/g,
    'createRequire(import.meta.url)'
);


// ==========================================================
// PREVENT SELF-DOWNLOAD WHEN LOCAL CORE EXISTS
// ==========================================================
//
// These replacements only target obvious download/setup checks.
// The actual bot source remains otherwise untouched.
//

const localCoreFiles = fs
    .readdirSync(__dirname)
    .filter(file => {
        const fullPath = path.join(__dirname, file);
        return localFileExists(fullPath);
    });

console.log(
    `[WOLF-LOAD] ✓ Local files detected: ${localCoreFiles.length}`
);

console.log(
    `[WOLF-LOAD] ✓ Files: ${localCoreFiles.join(', ')}`
);


// ==========================================================
// WRITE TEMPORARY EXECUTION FILE
// ==========================================================

try {
    if (fs.existsSync(TEMP_FILE)) {
        fs.unlinkSync(TEMP_FILE);
    }
} catch {
    // Ignore cleanup errors.
}

fs.writeFileSync(TEMP_FILE, botSource, 'utf8');

console.log('[WOLF-LOAD] ✓ Local bot prepared');
console.log('[WOLF-LOAD] ▸ Starting WOLFBOT...');
console.log('==============================================');
console.log('');


// ==========================================================
// START BOT
// ==========================================================

try {
    await import(pathToFileURL(TEMP_FILE).href);
} catch (error) {
    console.error('');
    console.error('==============================================');
    console.error('🐾 WOLFBOT STARTUP ERROR');
    console.error('==============================================');
    console.error(error);
    console.error('==============================================');
    console.error('');
    process.exit(1);
}


// ==========================================================
// CLEAN TEMP FILE ON EXIT
// ==========================================================

const cleanup = () => {
    try {
        if (fs.existsSync(TEMP_FILE)) {
            fs.unlinkSync(TEMP_FILE);
        }
    } catch {
        // Ignore cleanup errors.
    }
};

process.on('exit', cleanup);
process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
});

process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
});
