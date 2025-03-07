/* eslint-disable @typescript-eslint/no-non-null-assertion */
/// <reference types="@types/jest" />

import { loadSchema } from '@zenstackhq/testtools';

describe('Zod plugin tests', () => {
    let origDir: string;

    beforeEach(() => {
        origDir = process.cwd();
    });

    afterEach(() => {
        process.chdir(origDir);
    });

    it('basic generation', async () => {
        const { zodSchemas } = await loadSchema(
            `
        datasource db {
            provider = 'postgresql'
            url = env('DATABASE_URL')
        }
        
        generator js {
            provider = 'prisma-client-js'
        }
    
        plugin zod {
            provider = "@core/zod"
        }
    
        enum Role {
            USER
            ADMIN 
        }
    
        model User {
            id Int @id @default(autoincrement())
            createdAt DateTime @default(now())
            updatedAt DateTime @updatedAt
            email String @unique @email @endsWith('@zenstack.dev')
            password String @omit
            role Role @default(USER)
            posts Post[]
        }
        
        model Post {
            id Int @id @default(autoincrement())
            createdAt DateTime @default(now())
            updatedAt DateTime @updatedAt
            title String @length(5, 10)
            author User? @relation(fields: [authorId], references: [id])
            authorId Int?
            published Boolean @default(false)
            viewCount Int @default(0)
        }
        `,
            { addPrelude: false, pushDb: false }
        );
        const schemas = zodSchemas.models;
        expect(schemas.UserSchema).toBeTruthy();
        expect(schemas.UserCreateSchema).toBeTruthy();
        expect(schemas.UserUpdateSchema).toBeTruthy();

        // create
        expect(schemas.UserCreateSchema.safeParse({ email: 'abc' }).success).toBeFalsy();
        expect(schemas.UserCreateSchema.safeParse({ role: 'Cook' }).success).toBeFalsy();
        expect(schemas.UserCreateSchema.safeParse({ email: 'abc@def.com' }).success).toBeFalsy();
        expect(schemas.UserCreateSchema.safeParse({ email: 'abc@zenstack.dev' }).success).toBeFalsy();
        expect(
            schemas.UserCreateSchema.safeParse({ email: 'abc@zenstack.dev', password: 'abc123' }).success
        ).toBeTruthy();
        expect(
            schemas.UserCreateSchema.safeParse({ email: 'abc@zenstack.dev', role: 'ADMIN', password: 'abc123' }).success
        ).toBeTruthy();

        // create unchecked
        // create unchecked
        expect(
            zodSchemas.input.UserInputSchema.create.safeParse({
                data: { id: 1, email: 'abc@zenstack.dev', password: 'abc123' },
            }).success
        ).toBeTruthy();

        // update
        expect(schemas.UserUpdateSchema.safeParse({}).success).toBeTruthy();
        expect(schemas.UserUpdateSchema.safeParse({ email: 'abc@def.com' }).success).toBeFalsy();
        expect(schemas.UserUpdateSchema.safeParse({ email: 'def@zenstack.dev' }).success).toBeTruthy();
        expect(schemas.UserUpdateSchema.safeParse({ password: 'password456' }).success).toBeTruthy();

        // update unchecked
        expect(
            zodSchemas.input.UserInputSchema.update.safeParse({ where: { id: 1 }, data: { id: 2 } }).success
        ).toBeTruthy();

        // model schema
        expect(schemas.UserSchema.safeParse({ email: 'abc@zenstack.dev', role: 'ADMIN' }).success).toBeFalsy();
        // without omitted field
        expect(
            schemas.UserSchema.safeParse({
                id: 1,
                email: 'abc@zenstack.dev',
                role: 'ADMIN',
                createdAt: new Date(),
                updatedAt: new Date(),
            }).success
        ).toBeTruthy();
        // with omitted field
        const withPwd = schemas.UserSchema.safeParse({
            id: 1,
            email: 'abc@zenstack.dev',
            role: 'ADMIN',
            createdAt: new Date(),
            updatedAt: new Date(),
            password: 'abc123',
        });
        expect(withPwd.success).toBeTruthy();
        expect(withPwd.data.password).toBeUndefined();

        expect(schemas.PostSchema).toBeTruthy();
        expect(schemas.PostCreateSchema).toBeTruthy();
        expect(schemas.PostUpdateSchema).toBeTruthy();
        expect(schemas.PostCreateSchema.safeParse({ title: 'abc' }).success).toBeFalsy();
        expect(schemas.PostCreateSchema.safeParse({ title: 'abcabcabcabc' }).success).toBeFalsy();
        expect(schemas.PostCreateSchema.safeParse({ title: 'abcde' }).success).toBeTruthy();
    });

    it('mixed casing', async () => {
        const model = `
        datasource db {
            provider = 'postgresql'
            url = env('DATABASE_URL')
        }
        
        generator js {
            provider = 'prisma-client-js'
        }

        plugin zod {
            provider = "@core/zod"
        }        

        enum role {
            USER
            ADMIN 
        }

        model User {
            id Int @id @default(autoincrement())
            createdAt DateTime @default(now())
            updatedAt DateTime @updatedAt
            email String @unique @email @endsWith('@zenstack.dev')
            password String @omit
            role role @default(USER)
            posts post_item[]
            profile userProfile?
        }

        model userProfile {
            id Int @id @default(autoincrement())
            bio String
            user User @relation(fields: [userId], references: [id])
            userId Int @unique
        }
        
        model post_item {
            id Int @id @default(autoincrement())
            createdAt DateTime @default(now())
            updatedAt DateTime @updatedAt
            title String @length(5, 10)
            author User? @relation(fields: [authorId], references: [id])
            authorId Int?
            published Boolean @default(false)
            viewCount Int @default(0)
            reviews review[]
        }

        model review {
            id Int @id @default(autoincrement())
            post post_item @relation(fields: [postId], references: [id])
            postId Int @unique
        }
        `;

        await loadSchema(model, { addPrelude: false, pushDb: false });
    });

    it('attribute coverage', async () => {
        const model = `
        datasource db {
            provider = 'postgresql'
            url = env('DATABASE_URL')
        }
        
        generator js {
            provider = 'prisma-client-js'
        }

        plugin zod {
            provider = "@core/zod"
        }        

        model M {
            id Int @id @default(autoincrement())
            a String? @length(5, 10, 'must be between 5 and 10')
            b String? @length(5)
            c String? @length(min: 5, message: 'must be at least 5')
            d String? @length(max: 10)
            e String? @length(min: 5, max: 10, 'must be between 5 and 10')
            f String? @startsWith('abc', 'must start with abc')
            g String? @endsWith('abc', 'must end with abc')
            h String? @contains('abc', 'must contain abc')
            i String? @regex('^abc$', 'must match /^abc$/')
            j String? @email('must be an email')
            k String? @url('must be a url')
            l String? @datetime('must be a datetime')
            m Int? @gt(1, 'must be greater than 1')
            n Int? @gte(1, 'must be greater than or equal to 1')
            o Int? @lt(1, 'must be less than 1')
            p Int? @lte(1, 'must be less than or equal to 1')
            q Int[]
        }
        `;

        const { zodSchemas } = await loadSchema(model, { addPrelude: false, pushDb: false });

        const schema = zodSchemas.models.MCreateSchema;

        expect(schema.safeParse({ a: 'abc' }).error.toString()).toMatch(/must be between 5 and 10/);
        expect(schema.safeParse({ a: 'abcabcabcabc' }).error.toString()).toMatch(/must be between 5 and 10/);
        expect(schema.safeParse({ a: 'abcde' }).success).toBeTruthy();

        expect(schema.safeParse({ b: 'abc' }).success).toBeFalsy();
        expect(schema.safeParse({ b: 'abcde' }).success).toBeTruthy();

        expect(schema.safeParse({ c: 'abc' }).error.toString()).toMatch(/must be at least 5/);
        expect(schema.safeParse({ c: 'abcdef' }).success).toBeTruthy();

        expect(schema.safeParse({ d: 'abcabcabcabc' }).success).toBeFalsy();
        expect(schema.safeParse({ d: 'abcdef' }).success).toBeTruthy();

        expect(schema.safeParse({ e: 'abc' }).error.toString()).toMatch(/must be between 5 and 10/);
        expect(schema.safeParse({ e: 'abcabcabcabc' }).error.toString()).toMatch(/must be between 5 and 10/);
        expect(schema.safeParse({ e: 'abcde' }).success).toBeTruthy();

        expect(schema.safeParse({ f: 'abcde' }).success).toBeTruthy();
        expect(schema.safeParse({ f: '1abcde' }).error.toString()).toMatch(/must start with abc/);

        expect(schema.safeParse({ g: '123abc' }).success).toBeTruthy();
        expect(schema.safeParse({ g: '123abcd' }).error.toString()).toMatch(/must end with abc/);

        expect(schema.safeParse({ h: '123abcdef' }).success).toBeTruthy();
        expect(schema.safeParse({ h: '123abdef' }).error.toString()).toMatch(/must contain abc/);

        expect(schema.safeParse({ i: 'abc' }).success).toBeTruthy();
        expect(schema.safeParse({ i: '1abc' }).error.toString()).toMatch(/must match \/\^abc\$/);

        expect(schema.safeParse({ j: 'abc@zenstack.dev' }).success).toBeTruthy();
        expect(schema.safeParse({ j: 'abc@haha' }).error.toString()).toMatch(/must be an email/);

        expect(schema.safeParse({ k: 'https://zenstack.dev' }).success).toBeTruthy();
        expect(schema.safeParse({ k: 'abc123' }).error.toString()).toMatch(/must be a url/);

        expect(schema.safeParse({ l: '2020-01-01T00:00:00Z' }).success).toBeTruthy();
        expect(schema.safeParse({ l: '2020-01-01T00:00:00+02:00' }).success).toBeTruthy();
        expect(schema.safeParse({ l: '2022-01' }).error.toString()).toMatch(/must be a datetime/);

        expect(schema.safeParse({ m: 2 }).success).toBeTruthy();
        expect(schema.safeParse({ m: 1 }).error.toString()).toMatch(/must be greater than 1/);

        expect(schema.safeParse({ n: 1 }).success).toBeTruthy();
        expect(schema.safeParse({ n: 0 }).error.toString()).toMatch(/must be greater than or equal to 1/);

        expect(schema.safeParse({ o: 0 }).success).toBeTruthy();
        expect(schema.safeParse({ o: 1 }).error.toString()).toMatch(/must be less than 1/);

        expect(schema.safeParse({ p: 1 }).success).toBeTruthy();
        expect(schema.safeParse({ p: 2 }).error.toString()).toMatch(/must be less than or equal to 1/);

        expect(schema.safeParse({ q: [1] }).success).toBeTruthy();
        expect(schema.safeParse({ q: ['abc'] }).success).toBeFalsy();
    });

    it('refinement scalar fields', async () => {
        const model = `
        datasource db {
            provider = 'postgresql'
            url = env('DATABASE_URL')
        }
        
        generator js {
            provider = 'prisma-client-js'
        }

        model M {
            id Int @id @default(autoincrement())
            email String?
            x Int?
            dtStr String?
            url String?
            dt DateTime?
            s1 String?
            s2 String?
            s3 String?

            @@validate(email(email) && x > 0, 'condition1')
            @@validate(length(email, 5, 10), 'condition2')
            @@validate(regex(email, 'a[b|c]d'), 'condition3')
            @@validate(dtStr == null || datetime(dtStr), 'condition4')
            @@validate(!url || url(url), 'condition5')
            @@validate(!dt || dt < now(), 'condition6')
            @@validate(!s1 || contains(s1, 'abc'), 'condition7')
            @@validate(!s2 || startsWith(s2, 'abc'), 'condition8')
            @@validate(!s3 || endsWith(s3, 'abc'), 'condition9')
        }
        `;

        const { zodSchemas } = await loadSchema(model, { addPrelude: false, pushDb: false });

        const schema = zodSchemas.models.MCreateSchema;
        expect(schema.safeParse({ email: 'abd@x.com', x: 0 }).error.toString()).toMatch(/condition1/);
        expect(schema.safeParse({ email: 'abd@x.com', x: 1 }).success).toBeTruthy();
        expect(schema.safeParse({ email: 'someone@microsoft.com', x: 1 }).error.toString()).toMatch(/condition2/);
        expect(schema.safeParse({ email: 'xyz@x.com', x: 1 }).error.toString()).toMatch(/condition3/);

        expect(schema.safeParse({ dtStr: '2020-01' }).error.toString()).toMatch(/condition4/);
        expect(schema.safeParse({ email: 'abd@x.com', x: 1, dtStr: '2020-01-01T00:00:00+02:00' }).success).toBeTruthy();

        expect(schema.safeParse({ url: 'xyz.com' }).error.toString()).toMatch(/condition5/);
        expect(schema.safeParse({ email: 'abd@x.com', x: 1, url: 'https://zenstack.dev' }).success).toBeTruthy();

        expect(schema.safeParse({ email: 'abd@x.com', x: 1, dt: new Date('2030-01-01') }).error.toString()).toMatch(
            /condition6/
        );
        expect(schema.safeParse({ email: 'abd@x.com', x: 1, dt: new Date('2020-01-01') }).success).toBeTruthy();

        expect(schema.safeParse({ email: 'abd@x.com', x: 1, s1: '1abc2' }).success).toBeTruthy();
        expect(schema.safeParse({ s1: 'abd' }).error.toString()).toMatch(/condition7/);

        expect(schema.safeParse({ email: 'abd@x.com', x: 1, s2: 'abc1' }).success).toBeTruthy();
        expect(schema.safeParse({ s2: '1abc' }).error.toString()).toMatch(/condition8/);

        expect(schema.safeParse({ email: 'abd@x.com', x: 1, s3: '1abc' }).success).toBeTruthy();
        expect(schema.safeParse({ s3: 'abc1' }).error.toString()).toMatch(/condition9/);
    });

    it('refinement collection fields', async () => {
        const model = `
        datasource db {
            provider = 'postgresql'
            url = env('DATABASE_URL')
        }
        
        generator js {
            provider = 'prisma-client-js'
        }

        plugin zod {
            provider = "@core/zod"
        }

        model M {
            id Int @id @default(autoincrement())
            arr Int[]

            @@validate(!isEmpty(arr), 'condition1')
            @@validate(has(arr, 1), 'condition2')
            @@validate(hasEvery(arr, [1, 2]), 'condition3')
            @@validate(hasSome(arr, [1, 2]), 'condition4')
        }
        `;

        const { zodSchemas } = await loadSchema(model, { addPrelude: false, pushDb: false });

        const schema = zodSchemas.models.MCreateSchema;
        expect(schema.safeParse({}).error.toString()).toMatch(/condition1/);
        expect(schema.safeParse({ arr: [] }).error.toString()).toMatch(/condition1/);
        expect(schema.safeParse({ arr: [3] }).error.toString()).toMatch(/condition2/);
        expect(schema.safeParse({ arr: [1] }).error.toString()).toMatch(/condition3/);
        expect(schema.safeParse({ arr: [4] }).error.toString()).toMatch(/condition4/);
        expect(schema.safeParse({ arr: [1, 2, 3] }).success).toBeTruthy();
    });

    it('full-text search', async () => {
        const model = `
        datasource db {
            provider = 'postgresql'
            url = env('DATABASE_URL')
        }
        
        generator js {
            provider = 'prisma-client-js'
            previewFeatures = ["fullTextSearch"]
        }

        plugin zod {
            provider = "@core/zod"
        }

        enum Role {
            USER
            ADMIN 
        }

        model User {
            id Int @id @default(autoincrement())
            createdAt DateTime @default(now())
            updatedAt DateTime @updatedAt
            email String @unique @email @endsWith('@zenstack.dev')
            password String @omit
            role Role @default(USER)
            posts post_Item[]
        }
        
        model post_Item {
            id Int @id @default(autoincrement())
            createdAt DateTime @default(now())
            updatedAt DateTime @updatedAt
            title String @length(5, 10)
            author User? @relation(fields: [authorId], references: [id])
            authorId Int?
            published Boolean @default(false)
            viewCount Int @default(0)
        }
        `;

        await loadSchema(model, { addPrelude: false, pushDb: false });
    });

    it('no unchecked input', async () => {
        const { zodSchemas } = await loadSchema(
            `
        datasource db {
            provider = 'postgresql'
            url = env('DATABASE_URL')
        }
        
        generator js {
            provider = 'prisma-client-js'
        }
    
        plugin zod {
            provider = "@core/zod"
            noUncheckedInput = true
        }
    
        enum Role {
            USER
            ADMIN 
        }
    
        model User {
            id Int @id @default(autoincrement())
            createdAt DateTime @default(now())
            updatedAt DateTime @updatedAt
            email String @unique @email @endsWith('@zenstack.dev')
            password String @omit
            role Role @default(USER)
            posts Post[]
        }
        
        model Post {
            id Int @id @default(autoincrement())
            createdAt DateTime @default(now())
            updatedAt DateTime @updatedAt
            title String @length(5, 10)
            author User? @relation(fields: [authorId], references: [id])
            authorId Int?
            published Boolean @default(false)
            viewCount Int @default(0)
        }
        `,
            { addPrelude: false, pushDb: false }
        );
        const schemas = zodSchemas.models;

        // create unchecked
        expect(
            zodSchemas.input.UserInputSchema.create.safeParse({
                data: { id: 1, email: 'abc@zenstack.dev', password: 'abc123' },
            }).success
        ).toBeFalsy();

        // update unchecked
        expect(
            zodSchemas.input.UserInputSchema.update.safeParse({ where: { id: 1 }, data: { id: 2 } }).success
        ).toBeFalsy();
    });
});
