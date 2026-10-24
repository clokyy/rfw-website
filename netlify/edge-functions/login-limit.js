// Netlify's shared edge counters apply across function instances (not a local Map).
export default async (_request, context) => context.next();
export const config = {
 path: '/.netlify/functions/admin-auth*',
 rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip','domain'] }
};
