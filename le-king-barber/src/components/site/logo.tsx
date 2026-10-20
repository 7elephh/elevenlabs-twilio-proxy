import Image from "next/image";

import logotype from "../../../public/brand/le-king-barber-ivory.png";
import monogram from "../../../public/brand/lk-monogram-ivory.png";
import monogramNoir from "../../../public/brand/lk-monogram-noir.png";
import logotypeNoir from "../../../public/brand/le-king-barber-noir.png";

export function Monogram({ className = "", tone = "ivoire", priority = false }: { className?: string; tone?: "ivoire" | "noir"; priority?: boolean }) {
  return <Image src={tone === "noir" ? monogramNoir : monogram} alt="Le King Barber" className={className} priority={priority} sizes="96px" />;
}

export function Logotype({ className = "", tone = "ivoire", priority = false }: { className?: string; tone?: "ivoire" | "noir"; priority?: boolean }) {
  return (
    <Image
      src={tone === "noir" ? logotypeNoir : logotype}
      alt="Le King Barber"
      className={className}
      priority={priority}
      sizes="(max-width: 768px) 60vw, 320px"
    />
  );
}
