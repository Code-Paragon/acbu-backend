import helmet from "helmet";

/**
 * Central security headers middleware for the API.
 */
export const securityHeadersMiddleware = helmet({
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
  referrerPolicy: {
    policy: "no-referrer",
  },
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "https://validator.swagger.io"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "https:"],
    },
  },
});
