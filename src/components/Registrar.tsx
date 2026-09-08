import NewProductEntryForm from "./NewProductEntryForm";

export default function Registrar() {
  return (
    <div className="flex flex-col gap-6">
      <div className="no-print">
        <h1 className="text-2xl font-bold text-stone-900">Nuevo producto</h1>
        <p className="text-sm text-stone-400 mt-0.5">
          Registra un producto nuevo en el almacén. Para mover stock de productos ya
          registrados, usa <strong>Entradas</strong> y <strong>Salidas</strong>.
        </p>
      </div>
      <NewProductEntryForm />
    </div>
  );
}
