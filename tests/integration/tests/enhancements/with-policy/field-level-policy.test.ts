import { loadSchema } from '@zenstackhq/testtools';
import path from 'path';

describe('With Policy: field-level policy', () => {
    let origDir: string;

    beforeAll(async () => {
        origDir = path.resolve('.');
    });

    afterEach(() => {
        process.chdir(origDir);
    });

    it('read simple', async () => {
        const { prisma, withPolicy } = await loadSchema(
            `
        model User {
            id Int @id @default(autoincrement())
            admin Boolean @default(false)
            models Model[]

            @@allow('all', true)
        }

        model Model {
            id Int @id @default(autoincrement())
            x Int
            y Int @allow('read', x > 0)
            owner User @relation(fields: [ownerId], references: [id])
            ownerId Int

            @@allow('all', true)
        }
        `
        );

        await prisma.user.create({ data: { id: 1, admin: true } });

        const db = withPolicy();
        let r;

        // y is unreadable

        r = await db.model.create({
            data: {
                id: 1,
                x: 0,
                y: 0,
                ownerId: 1,
            },
        });
        expect(r.x).toEqual(0);
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ where: { id: 1 } });
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ select: { x: true }, where: { id: 1 } });
        expect(r.x).toEqual(0);
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ select: { y: true }, where: { id: 1 } });
        expect(r.x).toBeUndefined();
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ select: { x: false, y: true }, where: { id: 1 } });
        expect(r.x).toBeUndefined();
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ select: { x: true, y: true }, where: { id: 1 } });
        expect(r.x).toEqual(0);
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ include: { owner: true }, where: { id: 1 } });
        expect(r.x).toEqual(0);
        expect(r.owner).toBeTruthy();
        expect(r.y).toBeUndefined();

        // y is readable

        r = await db.model.create({
            data: {
                id: 2,
                x: 1,
                y: 0,
                ownerId: 1,
            },
        });
        expect(r).toEqual(expect.objectContaining({ x: 1, y: 0 }));

        r = await db.model.findUnique({ where: { id: 2 } });
        expect(r).toEqual(expect.objectContaining({ x: 1, y: 0 }));

        r = await db.model.findUnique({ select: { x: true }, where: { id: 2 } });
        expect(r.x).toEqual(1);
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ select: { y: true }, where: { id: 2 } });
        expect(r.x).toBeUndefined();
        expect(r.y).toEqual(0);

        r = await db.model.findUnique({ select: { x: false, y: true }, where: { id: 2 } });
        expect(r.x).toBeUndefined();
        expect(r.y).toEqual(0);

        r = await db.model.findUnique({ select: { x: true, y: true }, where: { id: 2 } });
        expect(r).toEqual(expect.objectContaining({ x: 1, y: 0 }));

        r = await db.model.findUnique({ include: { owner: true }, where: { id: 2 } });
        expect(r).toEqual(expect.objectContaining({ x: 1, y: 0 }));
        expect(r.owner).toBeTruthy();
    });

    it('read filter with auth', async () => {
        const { prisma, withPolicy } = await loadSchema(
            `
        model User {
            id Int @id @default(autoincrement())
            admin Boolean @default(false)
            models Model[]

            @@allow('all', true)
        }
        
        model Model {
            id Int @id @default(autoincrement())
            x Int
            y Int @allow('read', auth().admin)
            owner User @relation(fields: [ownerId], references: [id])
            ownerId Int

            @@allow('all', true)
        }
        `,
            { logPrismaQuery: true }
        );

        await prisma.user.create({ data: { id: 1, admin: true } });

        let db = withPolicy({ id: 1, admin: false });
        let r;

        // y is unreadable

        r = await db.model.create({
            data: {
                id: 1,
                x: 0,
                y: 0,
                ownerId: 1,
            },
        });
        expect(r.x).toEqual(0);
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ where: { id: 1 } });
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ select: { x: true }, where: { id: 1 } });
        expect(r.x).toEqual(0);
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ select: { y: true }, where: { id: 1 } });
        expect(r.x).toBeUndefined();
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ select: { x: false, y: true }, where: { id: 1 } });
        expect(r.x).toBeUndefined();
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ select: { x: true, y: true }, where: { id: 1 } });
        expect(r.x).toEqual(0);
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ include: { owner: true }, where: { id: 1 } });
        expect(r.x).toEqual(0);
        expect(r.owner).toBeTruthy();
        expect(r.y).toBeUndefined();

        // y is readable
        db = withPolicy({ id: 1, admin: true });
        r = await db.model.create({
            data: {
                id: 2,
                x: 1,
                y: 0,
                ownerId: 1,
            },
        });
        expect(r).toEqual(expect.objectContaining({ x: 1, y: 0 }));

        r = await db.model.findUnique({ where: { id: 2 } });
        expect(r).toEqual(expect.objectContaining({ x: 1, y: 0 }));

        r = await db.model.findUnique({ select: { x: true }, where: { id: 2 } });
        expect(r.x).toEqual(1);
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ select: { y: true }, where: { id: 2 } });
        expect(r.x).toBeUndefined();
        expect(r.y).toEqual(0);

        r = await db.model.findUnique({ select: { x: false, y: true }, where: { id: 2 } });
        expect(r.x).toBeUndefined();
        expect(r.y).toEqual(0);

        r = await db.model.findUnique({ select: { x: true, y: true }, where: { id: 2 } });
        expect(r).toEqual(expect.objectContaining({ x: 1, y: 0 }));

        r = await db.model.findUnique({ include: { owner: true }, where: { id: 2 } });
        expect(r).toEqual(expect.objectContaining({ x: 1, y: 0 }));
        expect(r.owner).toBeTruthy();
    });

    it('read filter with relation', async () => {
        const { prisma, withPolicy } = await loadSchema(
            `
        model User {
            id Int @id @default(autoincrement())
            admin Boolean @default(false)
            models Model[]

            @@allow('all', true)
        }
        
        model Model {
            id Int @id @default(autoincrement())
            x Int
            y Int @allow('read', owner.admin)
            owner User @relation(fields: [ownerId], references: [id])
            ownerId Int

            @@allow('all', true)
        }
        `
        );

        await prisma.user.create({ data: { id: 1, admin: false } });
        await prisma.user.create({ data: { id: 2, admin: true } });

        const db = withPolicy();
        let r;

        // y is unreadable

        r = await db.model.create({
            data: {
                id: 1,
                x: 0,
                y: 0,
                ownerId: 1,
            },
        });
        expect(r.x).toEqual(0);
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ where: { id: 1 } });
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ select: { x: true }, where: { id: 1 } });
        expect(r.x).toEqual(0);
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ select: { y: true }, where: { id: 1 } });
        expect(r.x).toBeUndefined();
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ select: { x: false, y: true }, where: { id: 1 } });
        expect(r.x).toBeUndefined();
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ select: { x: true, y: true }, where: { id: 1 } });
        expect(r.x).toEqual(0);
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ include: { owner: true }, where: { id: 1 } });
        expect(r.x).toEqual(0);
        expect(r.owner).toBeTruthy();
        expect(r.y).toBeUndefined();

        // y is readable
        r = await db.model.create({
            data: {
                id: 2,
                x: 1,
                y: 0,
                ownerId: 2,
            },
        });
        expect(r).toEqual(expect.objectContaining({ x: 1, y: 0 }));

        r = await db.model.findUnique({ where: { id: 2 } });
        expect(r).toEqual(expect.objectContaining({ x: 1, y: 0 }));

        r = await db.model.findUnique({ select: { x: true }, where: { id: 2 } });
        expect(r.x).toEqual(1);
        expect(r.y).toBeUndefined();

        r = await db.model.findUnique({ select: { y: true }, where: { id: 2 } });
        expect(r.x).toBeUndefined();
        expect(r.y).toEqual(0);

        r = await db.model.findUnique({ select: { x: false, y: true }, where: { id: 2 } });
        expect(r.x).toBeUndefined();
        expect(r.y).toEqual(0);

        r = await db.model.findUnique({ select: { x: true, y: true }, where: { id: 2 } });
        expect(r).toEqual(expect.objectContaining({ x: 1, y: 0 }));

        r = await db.model.findUnique({ include: { owner: true }, where: { id: 2 } });
        expect(r).toEqual(expect.objectContaining({ x: 1, y: 0 }));
        expect(r.owner).toBeTruthy();
    });

    it('read coverage', async () => {
        const { prisma, withPolicy } = await loadSchema(
            `
        model Model {
            id Int @id @default(autoincrement())
            x Int
            y Int @allow('read', x > 0)

            @@allow('all', true)
        }
        `
        );

        const db = withPolicy();
        let r;

        // y is unreadable
        r = await db.model.create({
            data: {
                id: 1,
                x: 0,
                y: 0,
            },
        });

        r = await db.model.findUnique({ where: { id: 1 } });
        expect(r.y).toBeUndefined();

        r = await db.model.findUniqueOrThrow({ where: { id: 1 } });
        expect(r.y).toBeUndefined();

        r = await db.model.findFirst({ where: { id: 1 } });
        expect(r.y).toBeUndefined();

        r = await db.model.findFirstOrThrow({ where: { id: 1 } });
        expect(r.y).toBeUndefined();

        await db.model.create({
            data: {
                id: 2,
                x: 1,
                y: 0,
            },
        });
        r = await db.model.findMany({ where: { x: { gte: 0 } } });
        expect(r[0].y).toBeUndefined();
        expect(r[1].y).toEqual(0);
    });

    it('update simple', async () => {
        const { prisma, withPolicy } = await loadSchema(
            `
        model User {
            id Int @id @default(autoincrement())
            models Model[]

            @@allow('all', true)
        }
        
        model Model {
            id Int @id @default(autoincrement())
            x Int
            y Int @allow('update', x > 0)
            owner User @relation(fields: [ownerId], references: [id])
            ownerId Int

            @@allow('create,read', true)
            @@allow('update', y > 0)
        }
        `
        );

        await prisma.user.create({
            data: { id: 1 },
        });
        const db = withPolicy();

        await db.model.create({
            data: { id: 1, x: 0, y: 0, ownerId: 1 },
        });
        await expect(
            db.model.update({
                where: { id: 1 },
                data: { y: 2 },
            })
        ).toBeRejectedByPolicy();
        await expect(
            db.model.update({
                where: { id: 1 },
                data: { x: 2 },
            })
        ).toBeRejectedByPolicy();

        await db.model.create({
            data: { id: 2, x: 0, y: 1, ownerId: 1 },
        });
        await expect(
            db.model.update({
                where: { id: 2 },
                data: { y: 2 },
            })
        ).toBeRejectedByPolicy();
        await expect(
            db.model.update({
                where: { id: 2 },
                data: { x: 2 },
            })
        ).toResolveTruthy();

        await db.model.create({
            data: { id: 3, x: 1, y: 1, ownerId: 1 },
        });
        await expect(
            db.model.update({
                where: { id: 3 },
                data: { y: 2 },
            })
        ).toResolveTruthy();
    });

    it('update filter with relation', async () => {
        const { prisma, withPolicy } = await loadSchema(
            `
        model User {
            id Int @id @default(autoincrement())
            models Model[]
            admin Boolean @default(false)

            @@allow('all', true)
        }
        
        model Model {
            id Int @id @default(autoincrement())
            x Int
            y Int @allow('update', owner.admin)
            owner User @relation(fields: [ownerId], references: [id])
            ownerId Int

            @@allow('all', true)
        }
        `
        );

        await prisma.user.create({
            data: { id: 1, admin: false },
        });
        await prisma.user.create({
            data: { id: 2, admin: true },
        });
        const db = withPolicy();

        await db.model.create({
            data: { id: 1, x: 0, y: 0, ownerId: 1 },
        });
        await expect(
            db.model.update({
                where: { id: 1 },
                data: { y: 2 },
            })
        ).toBeRejectedByPolicy();
        await expect(
            db.model.update({
                where: { id: 1 },
                data: { x: 2 },
            })
        ).toResolveTruthy();

        await db.model.create({
            data: { id: 2, x: 0, y: 0, ownerId: 2 },
        });
        await expect(
            db.model.update({
                where: { id: 2 },
                data: { y: 2 },
            })
        ).toResolveTruthy();
    });

    it('update to-many relation', async () => {
        const { prisma, withPolicy } = await loadSchema(
            `
        model User {
            id Int @id @default(autoincrement())
            models Model[]
            admin Boolean @default(false)

            @@allow('all', true)
        }
        
        model Model {
            id Int @id @default(autoincrement())
            x Int
            y Int @allow('update', owner.admin)
            owner User @relation(fields: [ownerId], references: [id])
            ownerId Int

            @@allow('all', true)
        }
        `
        );

        await prisma.user.create({
            data: { id: 1, admin: false, models: { create: { id: 1, x: 0, y: 0 } } },
        });
        await prisma.user.create({
            data: { id: 2, admin: true, models: { create: { id: 2, x: 0, y: 0 } } },
        });
        const db = withPolicy();

        await expect(
            db.user.update({
                where: { id: 1 },
                data: { models: { update: { where: { id: 1 }, data: { y: 2 } } } },
            })
        ).toBeRejectedByPolicy();
        await expect(
            db.user.update({
                where: { id: 1 },
                data: { models: { update: { where: { id: 1 }, data: { x: 2 } } } },
            })
        ).toResolveTruthy();

        await expect(
            db.user.update({
                where: { id: 2 },
                data: { models: { update: { where: { id: 2 }, data: { y: 2 } } } },
            })
        ).toResolveTruthy();
    });

    it('update to-one relation', async () => {
        const { prisma, withPolicy } = await loadSchema(
            `
        model User {
            id Int @id @default(autoincrement())
            model Model?
            admin Boolean @default(false)

            @@allow('all', true)
        }
        
        model Model {
            id Int @id @default(autoincrement())
            x Int
            y Int @allow('update', owner.admin)
            owner User @relation(fields: [ownerId], references: [id])
            ownerId Int @unique

            @@allow('all', true)
        }
        `
        );

        await prisma.user.create({
            data: { id: 1, admin: false, model: { create: { id: 1, x: 0, y: 0 } } },
        });
        await prisma.user.create({
            data: { id: 2, admin: true, model: { create: { id: 2, x: 0, y: 0 } } },
        });
        const db = withPolicy();

        await expect(
            db.user.update({
                where: { id: 1 },
                data: { model: { update: { data: { y: 2 } } } },
            })
        ).toBeRejectedByPolicy();
        await expect(
            db.user.update({
                where: { id: 1 },
                data: { model: { update: { y: 2 } } },
            })
        ).toBeRejectedByPolicy();
        await expect(
            db.user.update({
                where: { id: 1 },
                data: { model: { update: { data: { x: 2 } } } },
            })
        ).toResolveTruthy();
        await expect(
            db.user.update({
                where: { id: 1 },
                data: { model: { update: { x: 2 } } },
            })
        ).toResolveTruthy();

        await expect(
            db.user.update({
                where: { id: 2 },
                data: { model: { update: { data: { y: 2 } } } },
            })
        ).toResolveTruthy();
        await expect(
            db.user.update({
                where: { id: 2 },
                data: { model: { update: { y: 2 } } },
            })
        ).toResolveTruthy();
    });

    it('updateMany simple', async () => {
        const { prisma, withPolicy } = await loadSchema(
            `
        model User {
            id Int @id @default(autoincrement())
            models Model[]

            @@allow('all', true)
        }
        
        model Model {
            id Int @id @default(autoincrement())
            x Int
            y Int @allow('update', x > 0)
            owner User @relation(fields: [ownerId], references: [id])
            ownerId Int

            @@allow('all', true)
        }
        `
        );

        await prisma.user.create({
            data: {
                id: 1,
                models: {
                    create: [
                        { id: 1, x: 0, y: 0 },
                        { id: 2, x: 1, y: 0 },
                    ],
                },
            },
        });
        const db = withPolicy();

        await expect(db.model.updateMany({ data: { y: 2 } })).resolves.toEqual({ count: 1 });
        await expect(db.model.findUnique({ where: { id: 1 } })).resolves.toEqual(
            expect.objectContaining({ x: 0, y: 0 })
        );
        await expect(db.model.findUnique({ where: { id: 2 } })).resolves.toEqual(
            expect.objectContaining({ x: 1, y: 2 })
        );
    });

    it('updateMany nested', async () => {
        const { prisma, withPolicy } = await loadSchema(
            `
        model User {
            id Int @id @default(autoincrement())
            models Model[]

            @@allow('all', true)
        }
        
        model Model {
            id Int @id @default(autoincrement())
            x Int
            y Int @allow('update', x > 0)
            owner User @relation(fields: [ownerId], references: [id])
            ownerId Int

            @@allow('all', true)
        }
        `
        );

        await prisma.user.create({
            data: {
                id: 1,
                models: {
                    create: [
                        { id: 1, x: 0, y: 0 },
                        { id: 2, x: 1, y: 0 },
                    ],
                },
            },
        });
        const db = withPolicy();

        await expect(
            db.user.update({ where: { id: 1 }, data: { models: { updateMany: { data: { y: 2 } } } } })
        ).toResolveTruthy();
        await expect(db.model.findUnique({ where: { id: 1 } })).resolves.toEqual(
            expect.objectContaining({ x: 0, y: 0 })
        );
        await expect(db.model.findUnique({ where: { id: 2 } })).resolves.toEqual(
            expect.objectContaining({ x: 1, y: 2 })
        );

        await expect(
            db.user.update({ where: { id: 1 }, data: { models: { updateMany: { where: { id: 1 }, data: { y: 2 } } } } })
        ).toResolveTruthy();
        await expect(db.model.findUnique({ where: { id: 1 } })).resolves.toEqual(
            expect.objectContaining({ x: 0, y: 0 })
        );

        await expect(
            db.user.update({ where: { id: 1 }, data: { models: { updateMany: { where: { id: 2 }, data: { y: 3 } } } } })
        ).toResolveTruthy();
        await expect(db.model.findUnique({ where: { id: 2 } })).resolves.toEqual(
            expect.objectContaining({ x: 1, y: 3 })
        );
    });

    it('this expression', async () => {
        const { prisma, withPolicy } = await loadSchema(
            `
            model User {
                id Int @id
                username String @allow("all", auth() == this)
                @@allow('all', true)
              }
            `
        );

        await prisma.user.create({ data: { id: 1, username: 'test' } });

        // admin
        let r = await withPolicy({ id: 1, admin: true }).user.findFirst();
        expect(r.username).toEqual('test');

        // owner
        r = await withPolicy({ id: 1 }).user.findFirst();
        expect(r.username).toEqual('test');

        // anonymous
        r = await withPolicy().user.findFirst();
        expect(r.username).toBeUndefined();

        // non-owner
        r = await withPolicy({ id: 2 }).user.findFirst();
        expect(r.username).toBeUndefined();
    });

    it('collection predicate', async () => {
        const { prisma, withPolicy } = await loadSchema(
            `
        model User {
            id Int @id @default(autoincrement())
            foos Foo[]
            a Int @allow('read', foos?[x > 0 && bars![y > 0]])
            b Int @allow('read', foos^[x == 1])

            @@allow('all', true)
        }

        model Foo {
            id Int @id @default(autoincrement())
            x Int
            owner User @relation(fields: [ownerId], references: [id])
            ownerId Int
            bars Bar[]

            @@allow('all', true)
        }

        model Bar {
            id Int @id @default(autoincrement())
            y Int
            foo Foo @relation(fields: [fooId], references: [id])
            fooId Int

            @@allow('all', true)
        }
        `
        );

        const db = withPolicy();

        await prisma.user.create({
            data: {
                id: 1,
                a: 1,
                b: 2,
                foos: {
                    create: [
                        { x: 0, bars: { create: [{ y: 1 }] } },
                        { x: 1, bars: { create: [{ y: 0 }, { y: 1 }] } },
                    ],
                },
            },
        });

        let r = await db.user.findUnique({ where: { id: 1 } });
        expect(r.a).toBeUndefined();
        expect(r.b).toBeUndefined();

        await prisma.user.create({
            data: {
                id: 2,
                a: 1,
                b: 2,
                foos: {
                    create: [{ x: 2, bars: { create: [{ y: 0 }, { y: 1 }] } }],
                },
            },
        });
        r = await db.user.findUnique({ where: { id: 2 } });
        expect(r.a).toBeUndefined();
        expect(r.b).toBe(2);

        await prisma.user.create({
            data: {
                id: 3,
                a: 1,
                b: 2,
                foos: {
                    create: [{ x: 2 }],
                },
            },
        });
        r = await db.user.findUnique({ where: { id: 3 } });
        expect(r.a).toBe(1);

        await prisma.user.create({
            data: {
                id: 4,
                a: 1,
                b: 2,
                foos: {
                    create: [{ x: 2, bars: { create: [{ y: 1 }, { y: 2 }] } }],
                },
            },
        });
        r = await db.user.findUnique({ where: { id: 4 } });
        expect(r.a).toBe(1);
        expect(r.b).toBe(2);
    });
});
