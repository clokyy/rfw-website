export default async (_request, context) => context.next();
export const config = {
 path: '/.netlify/functions/*',
 rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ['ip','domain'] }
};
