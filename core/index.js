import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_FILE = path.join(__dirname, 'wolf.js');
const TEMP_FILE = path.join(__dirname, '.bot_run.js');

console.log('');
console.log('==============================================');
console.log('🐾 WOLFBOT LOCAL CORE LOADER');
console.log('==============================================');
console.log(`[WOLF-LOAD] Core directory: ${__dirname}`);


// ==========================================================
// ERROR CAPTURE
// ==========================================================

process.on('uncaughtException', (error) => {
    console.error('');
    console.error('==============================================');
    console.error('🐾 WOLFBOT UNCAUGHT EXCEPTION');
    console.error('==============================================');
    console.error(error?.stack || error);
    console.error('==============================================');
});

process.on('unhandledRejection', (reason) => {
    console.error('');
    console.error('==============================================');
    console.error('🐾 WOLFBOT UNHANDLED REJECTION');
    console.error('==============================================');
    console.error(reason?.stack || reason);
    console.error('==============================================');
});

process.on('beforeExit', (code) => {
    console.log(`[WOLF-LOAD] ⚠ Node is preparing to exit. Code: ${code}`);
});

process.on('exit', (code) => {
    console.log(`[WOLF-LOAD] ⚠ Process exited. Code: ${code}`);
});


// ==========================================================
// CHECK BOT
// ==========================================================

if (!fs.existsSync(BOT_FILE)) {
    console.error('[WOLF-LOAD] ✖ wolf.js was not found.');
    console.error(`[WOLF-LOAD] Expected: ${BOT_FILE}`);
    process.exit(1);
}

console.log('[WOLF-LOAD] ✓ Local wolf.js found');
console.log('[WOLF-LOAD] ✓ Local core detected');
console.log('[WOLF-LOAD] ▸ Using existing local bot files');


// ==========================================================
// PATCH HTTP
// ==========================================================

function patchHttpModule(module) {
    const originalRequest = module.request;

    module.request = function (...args) {
        const req = originalRequest.apply(this, args);

        req.on('error', (error) => {
            console.error(
                '[WOLF-LOAD] HTTP error:',
                error?.message || error
            );
        });

        return req;
    };
}

patchHttpModule(http);
patchHttpModule(https);


// ==========================================================
// PATCH FETCH
// ==========================================================

if (typeof globalThis.fetch === 'function') {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async function (...args) {
        try {
            const response = await originalFetch.apply(this, args);

            if (response.status === 404) {
                console.log(
                    '[WOLF-LOAD] ⚠ Remote request returned HTTP 404.'
                );
                console.log(
                    '[WOLF-LOAD] ✓ Local WOLFBOT files are still available.'
                );
            }

            return response;
        } catch (error) {
            console.error(
                '[WOLF-LOAD] fetch error:',
                error?.message || error
            );

            throw error;
        }
    };
}


// ==========================================================
// LOAD SOURCE
// ==========================================================

const botSource = fs.readFileSync(BOT_FILE, 'utf8');

console.log(
    `[WOLF-LOAD] ✓ wolf.js loaded (${Buffer.byteLength(botSource)} bytes)`
);


// ==========================================================
// CREATE REQUIRE FIX
// ==========================================================

let patchedSource = botSource;

patchedSource = patchedSource.replace(
    /createRequire\(\[([^\]]+)\]\)/g,
    'createRequire(import.meta.url)'
);

patchedSource = patchedSource.replace(
    /createRequire\(\[([^\]]+)\]/g,
    'createRequire(import.meta.url)'
);


// ==========================================================
// WRITE TEMP BOT
// ==========================================================

try {
    if (fs.existsSync(TEMP_FILE)) {
        fs.unlinkSync(TEMP_FILE);
    }

    fs.writeFileSync(TEMP_FILE, patchedSource, 'utf8');

    console.log('[WOLF-LOAD] ✓ Local bot prepared');
} catch (error) {
    console.error('[WOLF-LOAD] ✖ Failed preparing bot:');
    console.error(error?.stack || error);
    process.exit(1);
}


// ==========================================================
// START
// ==========================================================

console.log('[WOLF-LOAD] ▸ Starting WOLFBOT...');
console.log('==============================================');
console.log('');

try {
    await import(pathToFileURL(TEMP_FILE).href);

    console.log('');
    console.log('[WOLF-LOAD] ✓ wolf.js import completed');

} catch (error) {

    console.error('');
    console.error('==============================================');
    console.error('🐾 WOLFBOT STARTUP ERROR');
    console.error('==============================================');
    console.error(error?.stack || error);
    console.error('==============================================');
    console.error('');

    process.exitCode = 1;
}


// ==========================================================
// KEEP PROCESS ALIVE
// ==========================================================
//
// Some bot versions finish the import while their startup
// process has not yet created a persistent event loop.
//

setInterval(() => {
    // Keep the Render process alive while WOLFBOT is running.
}, 30000);


// ==========================================================
// CLEANUP
// ==========================================================

function cleanup() {
    try {
        if (fs.existsSync(TEMP_FILE)) {
            fs.unlinkSync(TEMP_FILE);
        }
    } catch {
        // Ignore cleanup errors.
    }
}

process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
});

process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
});
