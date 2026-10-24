export default async (_request, context) => context.next();
export const config = {
 path: '/.netlify/functions/admin-password*',
 rateLimit: { windowLimit: 6, windowSize: 60, aggregateBy: ['ip','domain'] }
};
