import 'reflect-metadata';
import { BrokerType } from 'src/interfaces';
import { PublisherFactory } from 'src/services/queues/publisher-factory.service';
import { MediaMigrationPublisherDatabase } from './database/media-migration-publisher-database.service';
import { MediaMigrationPublisherRedis } from './redis/media-migration-publisher-redis.service';
import { MediaMigrationPublisher } from './rabbitmq/media-migration-publisher.service';

// Publishers are built without their message services: only the queue configuration is checked here.
const publishers = {
  database: new MediaMigrationPublisherDatabase(null as any, null as any),
  redis: new MediaMigrationPublisherRedis(null as any, null as any),
  rabbitmq: new MediaMigrationPublisher(null as any, null as any),
};

describe('media migration queue brokers', () => {
  it.each([
    ['database', BrokerType.Database, 'solid_media_migration_queue_db'],
    ['redis', BrokerType.Redis, 'solid_media_migration_queue_redis'],
    ['rabbitmq', BrokerType.RabbitMQ, 'solid_media_migration_queue'],
  ])('%s publisher uses its own broker and a separate queue', (broker, type, queueName) => {
    const options = publishers[broker as keyof typeof publishers].options();
    expect(options.type).toBe(type);
    expect(options.queueName).toBe(queueName);
  });

  it('gives each broker a different queue, so jobs never reach the wrong broker', () => {
    const names = Object.values(publishers).map(publisher => publisher.options().queueName);
    expect(new Set(names).size).toBe(3);
  });

  it.each([
    ['database', MediaMigrationPublisherDatabase],
    ['redis', MediaMigrationPublisherRedis],
    ['rabbitmq', MediaMigrationPublisher],
  ])('the publisher factory resolves the %s publisher when that broker is the default', async (broker, expected) => {
    // The factory looks up "<name><Broker>" first, then the plain name, which is how the engine publishes.
    const instances = [publishers.database, publishers.redis, publishers.rabbitmq];
    const introspection = {
      getProvider: (name: string) => {
        const match = instances.find(instance => instance.constructor.name === name);
        return match ? { instance: match, name } : undefined;
      },
    };
    const factory = new PublisherFactory<any>(introspection as any);
    const published: any[] = [];
    for (const instance of instances) {
      (instance as any).publish = async (message: any) => { published.push(instance.constructor); return 'id'; };
    }

    await factory.publish({ payload: { jobId: 1 } } as any, 'MediaMigrationPublisher', broker);
    expect(published).toEqual([expected]);
  });
});
