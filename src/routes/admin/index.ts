import type { FastifyPluginAsync } from 'fastify';
import { adminUrlRoutes } from './urls.js';
import { adminStatsRoutes } from './stats.js';

export const adminRoutes: FastifyPluginAsync = async (app) => {
  await app.register(adminUrlRoutes);
  await app.register(adminStatsRoutes);
};
