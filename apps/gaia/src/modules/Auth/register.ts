import argon2 from 'argon2';
import { Arg, Ctx, Mutation, Resolver } from 'type-graphql';
import { v4 } from 'uuid';

import { User, UserCreateInput } from '@generated/type-graphql';
import { GaiaContext } from '../../config/context';
import { UserResponse } from '../../types/response/UserResponse';
import { minutesAdder } from '../../utils/minutesAdder';
import { mail } from '@olympus/mail';

@Resolver(() => User)
export class RegisterMutation {
  @Mutation(() => UserResponse)
  async register(
    @Arg('options') options: UserCreateInput,
    @Ctx() { req, prisma }: GaiaContext
  ): Promise<UserResponse> {
    const password = await argon2.hash(options.password);
    const user = await prisma.user.create({
      data: {
        email: options.email,
        password,
        name: options.name,
      },
    });

    req.session.userId = user.id;

    if (user) {
      const token: string = v4();
      const url = `http://localhost:3000/verify/${token}`;
      await prisma.tokens.create({
        data: {
          userId: user.id,
          type: 'ACCOUNT_VERIFICATION',
          expire: minutesAdder(new Date(), 60).toISOString(),
          token,
        },
      });

      await mail(user.email, url, user.name, 'WELCOME');

      return { user };
    } else {
      return {
        errors: [
          {
            field: 'user',
            message: 'not found',
          },
        ],
      };
    }
  }
}
