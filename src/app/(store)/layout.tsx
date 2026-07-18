import { CartProvider } from "@/components/cart/cart-ui";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { getSettings } from "@/lib/settings";

export default async function StoreLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSettings();
  const phone = settings.restaurant.phones[0]?.replace(/\s/g, "") ?? "0722305909";

  return (
    <CartProvider minOrder={settings.delivery.min_order}>
      <Header phone={phone} />
      <main>{children}</main>
      <Footer restaurant={settings.restaurant} hours={settings.hours} />
    </CartProvider>
  );
}
