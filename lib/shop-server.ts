import type { Database } from '../db/adapter';
import { shopProducts, validatePurchase, ShopError, type PurchaseReceipt, type ShopState } from './shop';

const receiptColumns = 'id, product_id AS "productId", quantity, unit_price AS "unitPrice", total, created_at AS "createdAt"';

export async function getShopState(db: Database, userId: string): Promise<ShopState> {
  // Repeatable-read keeps wallet, inventory and history in one snapshot.
  return db.transaction(async db => {
  const [wallet, inventory, history] = await db.batch([
    db.prepare(`SELECT COALESCE((SELECT SUM(amount) FROM quanaqyl.awards WHERE user_id=$1),0) AS "earned",
      COALESCE((SELECT SUM(total) FROM quanaqyl.shop_purchases WHERE user_id=$2),0) AS "spent"`).bind(userId, userId),
    db.prepare('SELECT product_id AS "productId", SUM(quantity) AS "quantity" FROM quanaqyl.shop_purchases WHERE user_id=$1 GROUP BY product_id ORDER BY MAX(created_at) DESC, product_id').bind(userId),
    db.prepare(`SELECT ${receiptColumns} FROM quanaqyl.shop_purchases WHERE user_id=$1 ORDER BY created_at DESC, id DESC LIMIT 20`).bind(userId),
  ]);
  const { earned, spent } = wallet.results[0] as { earned: number; spent: number };
  return { earned, spent, balance: earned - spent,
    inventory: inventory.results as ShopState['inventory'], purchases: history.results as PurchaseReceipt[] };
  }, 'repeatable read');
}

export async function purchaseProduct(db: Database, userId: string, input: unknown) {
  return db.transaction(async tx => {
  await tx.lock('wallet', userId);
  return purchaseLocked(tx, userId, input);
  });
}

async function purchaseLocked(db: Database, userId: string, input: unknown) {
  const request = validatePurchase(input);
  const product = shopProducts.find(p => p.id === request.productId)!;
  const readReceipt = () => db.prepare(`SELECT ${receiptColumns} FROM quanaqyl.shop_purchases WHERE user_id=$1 AND id=$2`)
    .bind(userId, request.requestId).first<PurchaseReceipt>();
  let receipt = await readReceipt();
  if (!receipt) {
    const total = product.price * request.quantity;
    // The wallet lock serializes purchases across tabs and server instances.
    // The client never supplies a trusted price.
    await db.prepare(`INSERT INTO quanaqyl.shop_purchases (user_id,id,product_id,quantity,unit_price,total,created_at)
      SELECT $1,$2,$3,$4,$5,$6,$7 WHERE
        COALESCE((SELECT SUM(amount) FROM quanaqyl.awards WHERE user_id=$8),0) -
        COALESCE((SELECT SUM(total) FROM quanaqyl.shop_purchases WHERE user_id=$9),0) >= $10
      ON CONFLICT(user_id,id) DO NOTHING`)
      .bind(userId, request.requestId, product.id, request.quantity, product.price, total, Date.now(), userId, userId, total).run();
    receipt = await readReceipt();
  }
  if (!receipt) throw new ShopError('shopInsufficient', 409);
  // Network retries return the original purchase; a reused ID cannot change it.
  if (receipt.productId !== request.productId || receipt.quantity !== request.quantity) throw new ShopError('shopConflict', 409);
  return { receipt, shop: await getShopState(db, userId) };
}
