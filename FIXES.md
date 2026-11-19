# Lumière – Fix Log (Hinglish)

## Main bug: stock UI mein kam nahi hota tha
1. **Redis cache kabhi clear nahi hota tha.** `/api/products` (`all_products`) aur `/api/products/[id]` (`product_<id>`) 5 minute cache hote hain. Order ke baad sirf admin edit par cache clear hota tha. Product page, cart, products list sab cached purani stock dikhate the.
   -> Ab order place / cancel par `invalidateProductCache()` chalta hai (`src/lib/cache.ts`).
2. **Product detail page poori products list cached API se utha ke find() karta tha.** Ab `/api/products/[id]?fresh=1` use hota hai (cache bypass) + tab focus par auto-refresh.
3. **Stock decrement ab atomic hai** (`src/lib/stock.ts`): `findOneAndUpdate({_id, stock:{$gte:qty}}, {$inc:{stock:-qty}})`. Race condition khatam, oversell nahi hoga, order save fail ho to stock rollback.

## Doosre bugs
- `selectedSize` order mein save nahi hota tha -> ab hota hai.
- Same product ki 2 sizes cart mein hon to stock double count nahi hota (merged check).
- `orders/[id]` PUT bina login ke koi bhi order cancel kar sakta tha -> ab auth + owner/admin + 30 min rule server par.
- Cancel par stock do baar restore ho sakta tha -> ab atomic, sirf ek baar.
- Product POST/PUT/DELETE par admin check nahi tha -> add kiya.
- Product PUT partial update par sale/discount reset kar deta tha -> ab sirf bheje gaye fields update hote hain.
- `authOptions` route.ts se export ho raha tha (Next build error deta hai) -> `src/lib/auth.ts` mein shift.
- `getServerSession()` ab sab jagah `getServerSession(authOptions)`.
- Do alag Order schemas aur do Product/Coupon models -> ek ek shared model (`src/models/`).
- CartContext hydration mismatch (localStorage useState mein) -> useEffect mein load + multi-tab sync.
- Cart/Checkout live price + live stock dikhate hain; stock issue par checkout block.
- Redis/Upstash down ho to API crash nahi hoti (fail-open cache + rate limit).
- Order rate limit ka alag bucket; `x-forwarded-for` ka pehla IP.
- Cart: `<Link><button>` invalid HTML hataya; faltu `router.refresh()` calls hataye.

## Behavior changes (jaanna zaroori)
- Cancelled order dobara Pending/Shipped nahi ho sakta (warna stock inconsistent hota). Naya order banayein.
- Admin ke baghair product add/edit/delete ab 401 dega.

## Zaroori: security
`.env.local` mein ek commented line mein MongoDB password plain text hai. Us password ko Atlas mein **rotate** karein aur comment delete karein. Git history mein bhi ho sakta hai.
