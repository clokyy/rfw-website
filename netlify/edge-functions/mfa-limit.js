export default async (_request, context) => context.next();
export const config = {
 path: '/.netlify/functions/admin-mfa*',
 rateLimit: { windowLimit: 8, windowSize: 60, aggregateBy: ['ip','domain'] }
};
