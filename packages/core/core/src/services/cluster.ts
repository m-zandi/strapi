import cluster from 'cluster';
import os from 'os';
import type { Core } from '@strapi/types';

export const IS_PRIMARY = 'STRAPI_CLUSTER_PRIMARY';

export const isPrimary = (): boolean =>
  process.env[IS_PRIMARY] === 'true' || cluster.isPrimary;

export const createClusterService = (strapi: Core.Strapi) => {
  return {
    async start(bootWorker: () => Promise<void>) {
      const enabled = strapi.config.get('server.cluster.enabled', false);

      if (!enabled) {
        process.env[IS_PRIMARY] = 'true';
        return bootWorker();
      }

      const numWorkers =
        strapi.config.get<number>('server.cluster.workers', 0) ||
        os.cpus().length;

      if (cluster.isPrimary) {
        process.env[IS_PRIMARY] = 'true';
        strapi.log.info(
          `[cluster] Primary process ${process.pid} — forking ${numWorkers} workers`
        );

        for (let i = 0; i < numWorkers; i++) {
          cluster.fork({ [IS_PRIMARY]: 'false' });
        }

        cluster.on('exit', (worker, code, signal) => {
          strapi.log.warn(
            `[cluster] Worker ${worker.process.pid} exited ` +
            `(code: ${code}, signal: ${signal}) — restarting`
          );
          cluster.fork({ [IS_PRIMARY]: 'false' });
        });
      } else {
        strapi.log.info(
          `[cluster] Worker ${process.pid} starting`
        );
        return bootWorker();
      }
    },
  };
};
