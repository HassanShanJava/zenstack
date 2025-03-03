/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { hash } from 'bcryptjs';
import { DEFAULT_PASSWORD_SALT_LENGTH } from '../constants';
import { getDefaultModelMeta } from '../loader';
import { DbClientContract, PrismaWriteActionType } from '../types';
import { NestedWriteVisitor } from './nested-write-visitor';
import { DefaultPrismaProxyHandler, PrismaProxyActions, makeProxy } from './proxy';
import { CommonEnhancementOptions, ModelMeta } from './types';

/**
 * Options for @see withPassword
 */
export interface WithPasswordOptions extends CommonEnhancementOptions {
    /**
     * Model metadata
     */
    modelMeta?: ModelMeta;
}

/**
 * Gets an enhanced Prisma client that supports @password attribute.
 */
export function withPassword<DbClient extends object = any>(prisma: DbClient, options?: WithPasswordOptions): DbClient {
    const _modelMeta = options?.modelMeta ?? getDefaultModelMeta(options?.loadPath);
    return makeProxy(
        prisma,
        _modelMeta,
        (_prisma, model) => new PasswordHandler(_prisma as DbClientContract, model, _modelMeta),
        'password'
    );
}

class PasswordHandler extends DefaultPrismaProxyHandler {
    constructor(prisma: DbClientContract, model: string, readonly modelMeta: ModelMeta) {
        super(prisma, model);
    }

    // base override
    protected async preprocessArgs(action: PrismaProxyActions, args: any) {
        const actionsOfInterest: PrismaProxyActions[] = ['create', 'createMany', 'update', 'updateMany', 'upsert'];
        if (args && args.data && actionsOfInterest.includes(action)) {
            await this.preprocessWritePayload(this.model, action as PrismaWriteActionType, args);
        }
        return args;
    }

    private async preprocessWritePayload(model: string, action: PrismaWriteActionType, args: any) {
        const visitor = new NestedWriteVisitor(this.modelMeta, {
            field: async (field, _action, data, context) => {
                const pwdAttr = field.attributes?.find((attr) => attr.name === '@password');
                if (pwdAttr && field.type === 'String') {
                    // hash password value
                    let salt: string | number | undefined = pwdAttr.args.find((arg) => arg.name === 'salt')
                        ?.value as string;
                    if (!salt) {
                        salt = pwdAttr.args.find((arg) => arg.name === 'saltLength')?.value as number;
                    }
                    if (!salt) {
                        salt = DEFAULT_PASSWORD_SALT_LENGTH;
                    }
                    context.parent[field.name] = await hash(data, salt);
                }
            },
        });

        await visitor.visit(model, action, args);
    }
}
