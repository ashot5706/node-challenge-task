import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorSchema1760807734792 implements MigrationInterface {
  name = 'RefactorSchema1760807734792';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // flush all tables and recreate with new schema
    await queryRunner.query(`DELETE FROM "tokens"`);

    await queryRunner.query(
      `CREATE TABLE "chains" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "chain_id" integer, "is_enabled" boolean NOT NULL DEFAULT true, "native_currency" character varying(10), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d000ae909cffdb7237cddad632c" UNIQUE ("name"), CONSTRAINT "UQ_cedff27e2bbff63f01d707239ba" UNIQUE ("chain_id"), CONSTRAINT "PK_f3c6ca7e7ad0f451e3b8f3dd378" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "isNative"`);
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "isProtected"`);
    await queryRunner.query(
      `ALTER TABLE "tokens" DROP COLUMN "lastUpdateAuthor"`
    );
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "timestamp"`);
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "chain_deid"`);
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "chain_name"`);
    await queryRunner.query(
      `ALTER TABLE "tokens" DROP COLUMN "chain_isenabled"`
    );
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "logo_id"`);
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "logo_tokenid"`);
    await queryRunner.query(
      `ALTER TABLE "tokens" DROP COLUMN "logo_bigrelativepath"`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" DROP COLUMN "logo_smallrelativepath"`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" DROP COLUMN "logo_thumbrelativepath"`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" DROP COLUMN "lastPriceUpdate"`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "is_native" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "is_protected" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "is_verified" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "last_update_author" character varying(100)`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "total_supply" numeric(38,0)`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "market_cap" numeric(28,0)`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "logo_url" character varying(1000)`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "last_price_update" TIMESTAMP NOT NULL DEFAULT now()`
    );
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "address"`);
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "address" character varying(100)`
    );
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "symbol"`);
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "symbol" character varying(20)`
    );
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "name"`);
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "name" character varying(100)`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ALTER COLUMN "chainId" DROP NOT NULL`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d003d93192ee08505366d5e24c" ON "tokens" ("last_price_update") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_daaf610565c9d7d4474420fc34" ON "tokens" ("symbol") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_234cf91b074d8b361650ac45ae" ON "tokens" ("address", "chain_id") `
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD CONSTRAINT "FK_c746998cf5b6cebc71392e20c3c" FOREIGN KEY ("chainId") REFERENCES "chains"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );

    console.log(
      'Database schema refactored successfully. Run seeders to populate initial data.'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tokens" DROP CONSTRAINT "FK_c746998cf5b6cebc71392e20c3c"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_234cf91b074d8b361650ac45ae"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_daaf610565c9d7d4474420fc34"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d003d93192ee08505366d5e24c"`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ALTER COLUMN "chainId" SET NOT NULL`
    );
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "name"`);
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "name" character varying`
    );
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "symbol"`);
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "symbol" character varying`
    );
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "address"`);
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "address" bytea NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" DROP COLUMN "last_price_update"`
    );
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "updated_at"`);
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "created_at"`);
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "logo_url"`);
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "market_cap"`);
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "total_supply"`);
    await queryRunner.query(
      `ALTER TABLE "tokens" DROP COLUMN "last_update_author"`
    );
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "is_verified"`);
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "is_protected"`);
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "is_native"`);
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "lastPriceUpdate" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "logo_thumbrelativepath" character varying NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "logo_smallrelativepath" character varying NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "logo_bigrelativepath" character varying NOT NULL`
    );
    await queryRunner.query(`ALTER TABLE "tokens" ADD "logo_tokenid" uuid`);
    await queryRunner.query(`ALTER TABLE "tokens" ADD "logo_id" uuid NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "chain_isenabled" boolean NOT NULL DEFAULT true`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "chain_name" character varying NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "chain_deid" numeric NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "lastUpdateAuthor" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "isProtected" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "isNative" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(`DROP TABLE "chains"`);
  }
}
