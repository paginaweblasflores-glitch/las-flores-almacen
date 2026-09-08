const anioEjemplo = new Date().getFullYear() - 1;

function Paso({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3.5">
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold text-sm flex items-center justify-center">
        {n}
      </span>
      <div className="flex flex-col gap-1 pt-0.5">
        <p className="text-sm font-semibold text-stone-800">{titulo}</p>
        <div className="text-sm text-stone-600 leading-relaxed">{children}</div>
      </div>
    </li>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-bold text-stone-900">{titulo}</h2>
      {children}
    </section>
  );
}

export default function GuiaCierreAnual({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-3xl flex flex-col gap-8 pb-10">
      <div>
        <button
          onClick={onBack}
          className="text-sm text-stone-500 hover:text-stone-800 font-medium inline-flex items-center gap-1.5 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Configuración
        </button>
        <h1 className="text-2xl font-bold text-stone-900 mt-3">Cómo funciona el cierre anual</h1>
        <p className="text-sm text-stone-500 mt-1 leading-relaxed">
          Esta guía explica qué hace el sistema, cuándo conviene hacer el cierre, qué te pide a ti y
          cómo hacerlo paso a paso. Está pensada para cualquier persona que quede a cargo del almacén.
        </p>
      </div>

      <Seccion titulo="¿Por qué existe el cierre?">
        <p className="text-sm text-stone-600 leading-relaxed">
          El sistema guarda <strong>cada entrada y cada salida</strong> que se registra, para siempre.
          El stock de cada producto se calcula sumando y restando toda esa historia. Con los años, esa
          lista crece a miles y miles de registros y el sistema se vuelve lento al abrir.
        </p>
        <p className="text-sm text-stone-600 leading-relaxed">
          El <strong>cierre anual</strong> resuelve esto una vez por año: guarda en un archivo Excel todo
          el detalle del año que terminó y deja el sistema solo con el <strong>stock actual</strong> de
          cada producto. Es como cerrar un cuaderno lleno y empezar uno nuevo anotando solo con cuánto
          quedas de cada cosa.
        </p>
      </Seccion>

      <Seccion titulo="Qué NO cambia">
        <ul className="text-sm text-stone-600 leading-relaxed flex flex-col gap-1.5">
          {[
            "El stock de cada producto. Si un producto tenía 12 unidades, después del cierre sigue teniendo 12.",
            "Los costos de cada producto.",
            "Los productos en sí: sus nombres, códigos, categorías y áreas quedan igual.",
            "No hay que volver a cargar el inventario. No se pierde ningún producto.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <span className="text-leaf-600 flex-shrink-0">✓</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion titulo="Qué sí cambia">
        <ul className="text-sm text-stone-600 leading-relaxed flex flex-col gap-1.5">
          {[
            "El detalle movimiento por movimiento del año cerrado sale de la aplicación. Queda guardado en el Excel que descargas.",
            'En su lugar, cada producto pasa a tener un único registro llamado "Saldo inicial" con su stock al 31 de diciembre.',
            "En el Panel de Inicio, los totales de Entradas y Salidas y el gráfico de los últimos meses vuelven a contar desde el cierre.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <span className="text-amber-600 flex-shrink-0">→</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion titulo="Cuándo se hace">
        <p className="text-sm text-stone-600 leading-relaxed">
          <strong>Una vez al año</strong>, a partir del <strong>1 de enero</strong>, para cerrar el año
          que acaba de terminar. No hay apuro de días: puedes hacerlo en enero, en febrero o cuando
          tengas un rato tranquilo. Lo recomendable es hacerlo en las <strong>primeras semanas de
          enero</strong>, antes de cargar muchos movimientos nuevos.
        </p>
      </Seccion>

      <Seccion titulo="El aviso del Panel de Inicio">
        <p className="text-sm text-stone-600 leading-relaxed">
          Desde el 1 de enero, si hay un cierre pendiente, aparece un <strong>aviso amarillo</strong> en
          la parte de arriba del Panel de Inicio que dice “Cierre del año {anioEjemplo} pendiente”.
        </p>
        <p className="text-sm text-stone-600 leading-relaxed">
          Ese aviso <strong>no se puede cerrar ni ocultar</strong>: va a seguir apareciendo cada vez que
          entres, como recordatorio, hasta que hagas el cierre. Cuando el cierre está hecho, el aviso
          <strong> desaparece solo</strong>.
        </p>
      </Seccion>

      <Seccion titulo="Cuándo se activa el botón">
        <p className="text-sm text-stone-600 leading-relaxed">
          En <strong>Configuración → Cierre de periodo</strong>. El botón{" "}
          <span className="font-mono text-xs bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded">
            Preparar cierre de {anioEjemplo}…
          </span>{" "}
          aparece solo cuando hay movimientos con fecha del año anterior (o más viejos). Si todavía no
          hay nada que cerrar, en su lugar dice “El primer cierre corresponderá en enero de …”.
        </p>
      </Seccion>

      <Seccion titulo="Paso a paso">
        <ol className="flex flex-col gap-5">
          <Paso n={1} titulo="Abre la pantalla de cierre">
            En el menú de la izquierda entra a <strong>Configuración</strong>. Baja hasta la sección{" "}
            <strong>Cierre de periodo</strong> y haz clic en <strong>Preparar cierre de {anioEjemplo}…</strong>
          </Paso>
          <Paso n={2} titulo="Revisa la vista previa">
            Se abre una ventana. Arriba te dice <strong>cuántos movimientos se van a archivar</strong> y{" "}
            <strong>cuántos productos van a quedar</strong>. Debajo hay una tabla con el stock de cada
            producto al 31 de diciembre. Revísala: los números deberían coincidir con lo que ves hoy en{" "}
            <strong>Inventario</strong>.
          </Paso>
          <Paso n={3} titulo="Descarga el respaldo en Excel">
            Haz clic en <strong>Descargar Movimientos-{anioEjemplo}.xlsx</strong>. Se baja un archivo con{" "}
            <strong>todo el detalle del año</strong>. <strong>Guárdalo en un lugar seguro</strong>: una
            carpeta del almacén, un pendrive, tu correo… donde no se pierda. Después del cierre, este
            archivo es la <strong>única copia</strong> del detalle. Si quieres, ábrelo para confirmar que
            tiene datos.
          </Paso>
          <Paso n={4} titulo='Marca la casilla de confirmación'>
            Marca <strong>“Ya guardé el Excel en un lugar seguro”</strong>. Hasta que descargues el
            archivo, esta casilla está bloqueada.
          </Paso>
          <Paso n={5} titulo="Escribe la frase de seguridad">
            En el campo, escribe exactamente{" "}
            <span className="font-mono text-xs bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded">
              CERRAR {anioEjemplo}
            </span>
            . Es una confirmación para evitar hacerlo sin querer.
          </Paso>
          <Paso n={6} titulo="Haz el cierre">
            Haz clic en <strong>Hacer el cierre</strong>. Espera unos segundos{" "}
            <strong>sin cerrar la ventana ni apagar la computadora</strong>. Al terminar aparece “Cierre
            de {anioEjemplo} hecho” y el aviso del Panel desaparece.
          </Paso>
        </ol>
      </Seccion>

      <Seccion titulo="Qué hace el sistema por su cuenta">
        <p className="text-sm text-stone-600 leading-relaxed">
          Durante esos segundos, el sistema hace todo esto solo, en orden:
        </p>
        <ol className="text-sm text-stone-600 leading-relaxed flex flex-col gap-1.5 list-decimal pl-5">
          <li>Calcula el stock de cada producto al 31 de diciembre.</li>
          <li>Crea un registro de “Saldo inicial” por producto con ese stock, con fecha 1 de enero.</li>
          <li>Verifica que se hayan creado todos los saldos.</li>
          <li>Recién entonces borra los movimientos viejos, de a poco.</li>
        </ol>
      </Seccion>

      <Seccion titulo="Si algo se corta a la mitad">
        <p className="text-sm text-stone-600 leading-relaxed">
          Si durante el cierre se corta el internet o se cierra la pestaña, <strong>no se pierde
          stock</strong>. Los saldos nuevos ya quedaron guardados. Solo vuelve a entrar a{" "}
          <strong>Configuración → Cierre de periodo</strong> y haz el cierre otra vez: el sistema{" "}
          <strong>no vuelve a crear los saldos</strong>, únicamente termina de borrar lo que faltó. No se
          duplica nada.
        </p>
      </Seccion>

      <Seccion titulo="Recomendaciones">
        <ul className="text-sm text-stone-600 leading-relaxed flex flex-col gap-1.5">
          {[
            "Hazlo en un momento tranquilo, cuando nadie más esté registrando movimientos.",
            "No registres entradas ni salidas mientras dura el proceso.",
            "Ten una conexión a internet estable.",
            "Guarda el Excel apenas se descargue, antes de continuar.",
            "Después del cierre, si necesitas consultar algo del año pasado (quién retiró algo, en qué fecha), está en el Excel: la aplicación ya no lo muestra.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <span className="text-stone-400 flex-shrink-0">•</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion titulo="Preguntas frecuentes">
        <dl className="flex flex-col gap-3">
          {[
            ["¿Se borran mis productos?", "No. Todos los productos siguen, con su stock, código, nombre, categoría y área."],
            ["¿Tengo que volver a cargar el inventario?", "No, nada. El sistema arma los saldos solo."],
            ["¿Y si me olvido y lo hago en marzo?", "No pasa nada. El aviso te sigue esperando y el cierre igual toma todo lo del año anterior."],
            ["¿Puedo deshacerlo?", "No. Por eso primero se descarga el Excel: si algo salió mal, el detalle completo está en ese archivo."],
            ["¿Cada cuánto se hace?", "Una vez al año."],
            ["¿Qué pasa si nunca lo hago?", "El sistema sigue funcionando, pero con los años se vuelve más lento al abrir. Por eso conviene hacerlo."],
          ].map(([q, a]) => (
            <div key={q}>
              <dt className="text-sm font-semibold text-stone-800">{q}</dt>
              <dd className="text-sm text-stone-600 leading-relaxed mt-0.5">{a}</dd>
            </div>
          ))}
        </dl>
      </Seccion>

      <div className="border-t border-stone-200 pt-5">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer"
        >
          Volver a Configuración
        </button>
      </div>
    </div>
  );
}
