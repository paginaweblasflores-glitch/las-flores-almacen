import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { TicketData } from "../types";

// Hook: muestra un comprobante y lo manda a imprimir. Espera a que el logo
// termine de cargar (si no, sale roto en la tiquetera) y limpia al terminar.
// Lo usan tanto el carrito de salida como el módulo de Comprobantes (reimpresión).
export function usarImpresionComprobante(): [TicketData | null, (t: TicketData) => void] {
  const [ticket, setTicket] = useState<TicketData | null>(null);

  // Precarga el logo para que ya esté en caché cuando toque imprimir.
  useEffect(() => {
    const img = new Image();
    img.src = "/logo.png";
  }, []);

  useEffect(() => {
    if (!ticket) return;
    let done = false;
    const doPrint = () => {
      if (done) return;
      done = true;
      window.print();
    };
    const after = () => setTicket(null);
    window.addEventListener("afterprint", after);

    const logo = document.querySelector<HTMLImageElement>(".ticket-portal img");
    if (logo && !logo.complete) {
      logo.addEventListener("load", doPrint, { once: true });
      logo.addEventListener("error", doPrint, { once: true });
      const fallback = window.setTimeout(doPrint, 1500);
      return () => {
        window.clearTimeout(fallback);
        window.removeEventListener("afterprint", after);
      };
    }
    doPrint();
    return () => window.removeEventListener("afterprint", after);
  }, [ticket]);

  return [ticket, setTicket];
}

// El comprobante en sí: portal directo en <body> para que el @media print lo
// aísle. Layout térmico de 64 mm, todo negro y en negrita.
export default function ComprobanteSalida({ ticket }: { ticket: TicketData }) {
  return createPortal(
    <div className="ticket-portal">
      <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: "6px", marginBottom: "6px" }}>
        <img
          src="/logo.png"
          alt="Las Flores"
          style={{ width: "40px", height: "40px", objectFit: "contain", display: "block", margin: "0 auto 4px" }}
        />
        <div style={{ fontWeight: 700, fontSize: "13px", letterSpacing: "0.02em", color: "#000" }}>
          Corporación Las Flores
        </div>
        <div style={{ fontWeight: 700, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#000", marginTop: "2px" }}>
          Comprobante de Salida de Almacén
        </div>
        {ticket.numero && (
          <div style={{ fontWeight: 700, fontSize: "11px", color: "#000", marginTop: "3px" }}>
            Número de Salida: {ticket.numero}
          </div>
        )}
      </div>

      <div style={{ borderBottom: "1px dashed #000", paddingBottom: "6px", marginBottom: "6px" }}>
        {[
          ["Fecha", ticket.fecha.split("-").reverse().join("/")],
          ["Área destino", ticket.area],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "11px", lineHeight: "1.6", fontWeight: 700, color: "#000" }}
          >
            <span style={{ flexShrink: 0 }}>{label}</span>
            <span style={{ textAlign: "right", wordBreak: "break-word", overflowWrap: "break-word", maxWidth: "60%" }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ borderBottom: "1px dashed #000", paddingBottom: "6px", marginBottom: "6px" }}>
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "10px", fontWeight: 700, color: "#000", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #000", paddingBottom: "3px", marginBottom: "4px" }}
        >
          <span>Producto</span>
          <span style={{ flexShrink: 0 }}>Cant.</span>
        </div>
        {ticket.items.map((it, idx) => (
          <div
            key={`${it.codigo}-${idx}`}
            style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "11px", lineHeight: "1.5", fontWeight: 700, color: "#000", marginBottom: "2px" }}
          >
            <span style={{ wordBreak: "break-word", overflowWrap: "break-word", maxWidth: "62%" }}>
              {it.descripcion}
            </span>
            <span style={{ flexShrink: 0 }}>
              {it.cantidad} {it.unidadMedida}
            </span>
          </div>
        ))}
      </div>

      {ticket.observaciones && (
        <div style={{ borderBottom: "1px dashed #000", paddingBottom: "6px", marginBottom: "6px" }}>
          <div style={{ fontSize: "9px", fontWeight: 700, color: "#000", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>
            Observaciones
          </div>
          <div style={{ fontSize: "11px", lineHeight: "1.5", fontWeight: 700, color: "#000", wordBreak: "break-word", overflowWrap: "break-word" }}>
            {ticket.observaciones}
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", paddingTop: ticket.observaciones ? "55px" : "75px" }}>
        <div style={{ borderTop: "1px solid #000", width: "60%", margin: "0 auto 4px" }} />
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#000" }}>{ticket.responsable}</div>
        <div style={{ fontSize: "9px", fontWeight: 700, color: "#000" }}>Recibí conforme</div>
      </div>

      <div style={{ textAlign: "center", borderTop: "1px dashed #000", marginTop: "10px", paddingTop: "5px", fontSize: "9px", fontWeight: 700, color: "#000" }}>
        Sistema Almacén · Corporación Las Flores
      </div>

      <br />
      <br />
      <br />
      <br />
      <br />
    </div>,
    document.body,
  );
}
