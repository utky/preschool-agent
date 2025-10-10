// Polyfill TextEncoder/TextDecoder
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill ReadableStream
const { ReadableStream } = require('stream/web');
global.ReadableStream = ReadableStream;

// Polyfill Web APIs for the test environment
const { Request, Response, Headers, fetch } = require('undici');
global.Request = Request;
global.Response = Response;
global.Headers = Headers;
global.fetch = fetch;
