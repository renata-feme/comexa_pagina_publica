/* ================================================================
   PORTAL CLIENTES — COMEXA CATERING
   Lógica del flujo de "Facturar un pedido" y "Consultar factura".

   IMPORTANTE:
   - Todo lo que aquí aparece marcado como MOCK es información de
     prueba para poder navegar y probar las pantallas.
   - No hay ninguna conexión a backend, PAC, Supabase ni API real.
   - No se guarda ningún dato fiscal ni personal en localStorage,
     sessionStorage ni cookies. El estado vive solo en memoria
     (variable JS) mientras la pestaña está abierta.
   ================================================================ */

(function () {
  'use strict';

  /* --------------------------------------------------------------
     A. DATOS MOCK
     -------------------------------------------------------------- */

  // TODO(API): Sustituir por la respuesta real del backend de pedidos.
  const PEDIDO_MOCK = {
    folio: 'COMEXA-2026-000123',
    fecha: '2026-08-10',
    fechaLegible: '10 de agosto de 2026',
    conceptos: [
      { descripcion: 'Desayuno ejecutivo', cantidad: 2, precioUnitario: 350.0 },
      { descripcion: 'Jugo de naranja', cantidad: 1, precioUnitario: 120.0 },
    ],
    subtotal: 820.0,
    iva: 131.2,
    total: 951.2,
  };

  // TODO(API): Sustituir por el catálogo real de regímenes fiscales del SAT
  // que debería llegar desde un endpoint propio o de Facturapi/Finkok.
  // Estas 3 opciones son solo demostrativas para poder probar la UI.
  const REGIMENES_FISCALES_MOCK = [
    { valor: '601', texto: '601 · General de Ley Personas Morales (demo)' },
    { valor: '612', texto: '612 · Personas Físicas con Actividad Empresarial (demo)' },
    { valor: '626', texto: '626 · Régimen Simplificado de Confianza (demo)' },
  ];

  // TODO(API): Sustituir por el catálogo real de usos de CFDI del SAT.
  const USOS_CFDI_MOCK = [
    { valor: 'G03', texto: 'G03 · Gastos en general (demo)' },
    { valor: 'P01', texto: 'P01 · Por definir (demo)' },
    { valor: 'CP01', texto: 'CP01 · Pagos (demo)' },
  ];

  // TODO(API): Sustituir por consulta real al backend de facturación.
  const FACTURA_MOCK = {
    folio: 'COMEXA-2026-000123',
    rfc: 'XAXX010101000',
    correo: 'demo@comexa.mx',
    uuid: '550e8400-e29b-41d4-a716-446655440000',
    estado: 'Timbrada',
    fechaEmision: '10/08/2026',
    total: 951.2,
  };

  /* --------------------------------------------------------------
     Estado en memoria (NO persistente, NO localStorage)
     -------------------------------------------------------------- */
  const estado = {
    pedido: null,
    datosFiscales: null,
  };

  /* --------------------------------------------------------------
     Utilidades
     -------------------------------------------------------------- */

  function formatoMoneda(numero) {
    return '$' + numero.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function mostrarError(elemento, mensaje) {
    if (!elemento) return;
    elemento.textContent = mensaje;
    elemento.classList.add('is-visible');
  }

  function limpiarError(elemento) {
    if (!elemento) return;
    elemento.textContent = '';
    elemento.classList.remove('is-visible');
  }

  function marcarCampoInvalido(input) {
    if (input) input.classList.add('has-error');
  }

  function limpiarCampoInvalido(input) {
    if (input) input.classList.remove('has-error');
  }

  /* ================================================================
     FLUJO: facturar.html
     ================================================================ */

  function initFacturarFlow() {
    const form1 = document.getElementById('form-localizar-pedido');
    if (!form1) return; // esta página no es facturar.html

    const pasos = document.querySelectorAll('.portal-step');
    const puntosNav = document.querySelectorAll('.portal-steps-nav span');

    function irAPaso(numeroPaso) {
      pasos.forEach(function (paso) {
        const esEstePaso = Number(paso.dataset.step) === numeroPaso;
        paso.hidden = !esEstePaso;
      });
      puntosNav.forEach(function (punto, indice) {
        punto.classList.toggle('is-active', indice === numeroPaso - 1);
      });
      const panel = document.querySelector('.portal-panel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ---------- Paso 1: localizar pedido ----------
       Mecanismo de acceso MANUAL (opción B). Requiere folio + fecha
       del servicio, ambos obligatorios.

       ARQUITECTURA FUTURA (no implementada todavía):
       Existirá un segundo mecanismo de acceso, PRINCIPAL, mediante un
       QR único impreso en cada ticket COMEXA. Ese QR llevará a esta
       misma página con un token seguro en la URL, por ejemplo
       conceptualmente: facturar.html?t=TOKEN_SEGURO
       Cuando esa funcionalidad exista, el backend validará el token y
       el flujo podrá saltar directo al Paso 2 "Pedido encontrado" sin
       pedir folio ni fecha al cliente. Este mecanismo manual (folio +
       fecha) se conservará como respaldo para quien no tenga o haya
       perdido su ticket/QR.
       TODO(API + futuro): al implementar el acceso por QR, agregar aquí
       una función del tipo intentarAccesoPorToken() que se ejecute al
       cargar la página, lea el parámetro "t" de la URL, lo valide contra
       el backend y, si es válido, llame directamente a mostrarPedido()
       + irAPaso(2), sin pasar por este formulario. -------- */
    const inputFolio = document.getElementById('folio-pedido');
    const inputFecha = document.getElementById('fecha-servicio');
    const errorBusqueda = document.getElementById('error-busqueda-pedido');

    form1.addEventListener('submit', function (evento) {
      evento.preventDefault();
      buscarPedido();
    });

    function buscarPedido() {
      limpiarError(errorBusqueda);
      [inputFolio, inputFecha].forEach(limpiarCampoInvalido);

      const folio = inputFolio.value.trim();
      const fecha = inputFecha.value.trim();

      if (!folio) {
        marcarCampoInvalido(inputFolio);
        mostrarError(errorBusqueda, 'Ingresa el folio de tu pedido para continuar.');
        inputFolio.focus();
        return;
      }

      if (!fecha) {
        marcarCampoInvalido(inputFecha);
        mostrarError(errorBusqueda, 'Ingresa la fecha del servicio para continuar.');
        inputFecha.focus();
        return;
      }

      // TODO(API): Reemplazar este bloque por una llamada real, por ejemplo:
      // const respuesta = await fetch('/api/pedidos/localizar', { method: 'POST', body: JSON.stringify({ folio, fecha }) });
      // const pedido = await respuesta.json();
      const coincideFolio = folio.toUpperCase() === PEDIDO_MOCK.folio;
      const coincideFecha = fecha === PEDIDO_MOCK.fecha;
      const encontrado = coincideFolio && coincideFecha;

      if (!encontrado) {
        // Mensaje genérico: no se revela cuál de los dos datos falló.
        mostrarError(
          errorBusqueda,
          'No encontramos un pedido con los datos proporcionados. Verifica la información e inténtalo nuevamente.'
        );
        return;
      }

      estado.pedido = PEDIDO_MOCK;
      mostrarPedido(estado.pedido);
      irAPaso(2);
    }

    /* ---------- Paso 2: pedido encontrado ---------- */
    function mostrarPedido(pedido) {
      document.getElementById('resumen-folio').textContent = pedido.folio;
      document.getElementById('resumen-fecha').textContent = pedido.fechaLegible;
      document.getElementById('resumen-subtotal').textContent = formatoMoneda(pedido.subtotal);
      document.getElementById('resumen-iva').textContent = formatoMoneda(pedido.iva);
      document.getElementById('resumen-total').textContent = formatoMoneda(pedido.total);

      const listaConceptos = document.getElementById('resumen-conceptos');
      listaConceptos.innerHTML = '';
      pedido.conceptos.forEach(function (item) {
        const fila = document.createElement('div');
        fila.className = 'invoice-item';
        const subtotalItem = item.cantidad * item.precioUnitario;
        fila.innerHTML =
          '<span><span class="qty">' + item.cantidad + ' ×</span>' + item.descripcion + '</span>' +
          '<span>' + formatoMoneda(subtotalItem) + '</span>';
        listaConceptos.appendChild(fila);
      });
    }

    const btnEsteNoEsMiPedido = document.getElementById('btn-no-es-mi-pedido');
    if (btnEsteNoEsMiPedido) {
      btnEsteNoEsMiPedido.addEventListener('click', function () {
        estado.pedido = null;
        form1.reset();
        limpiarError(errorBusqueda);
        irAPaso(1);
      });
    }

    const btnContinuarFacturacion = document.getElementById('btn-continuar-facturacion');
    if (btnContinuarFacturacion) {
      btnContinuarFacturacion.addEventListener('click', function () {
        poblarSelectsFiscales();
        irAPaso(3);
      });
    }

    /* ---------- Paso 3: datos fiscales ---------- */
    function poblarSelectsFiscales() {
      const selectRegimen = document.getElementById('regimen-fiscal');
      const selectUso = document.getElementById('uso-cfdi');

      // TODO(API): reemplazar por catálogo real obtenido del backend / SAT.
      if (selectRegimen && selectRegimen.options.length <= 1) {
        REGIMENES_FISCALES_MOCK.forEach(function (opcion) {
          const el = document.createElement('option');
          el.value = opcion.valor;
          el.textContent = opcion.texto;
          selectRegimen.appendChild(el);
        });
      }

      if (selectUso && selectUso.options.length <= 1) {
        USOS_CFDI_MOCK.forEach(function (opcion) {
          const el = document.createElement('option');
          el.value = opcion.valor;
          el.textContent = opcion.texto;
          selectUso.appendChild(el);
        });
      }
    }

    const formFiscal = document.getElementById('form-datos-fiscales');
    if (formFiscal) {
      formFiscal.addEventListener('submit', function (evento) {
        evento.preventDefault();
        validarFormularioFiscal();
      });
    }

    function validarFormularioFiscal() {
      const campos = {
        rfc: document.getElementById('rfc'),
        razonSocial: document.getElementById('razon-social'),
        codigoPostal: document.getElementById('codigo-postal'),
        regimenFiscal: document.getElementById('regimen-fiscal'),
        usoCfdi: document.getElementById('uso-cfdi'),
        correo: document.getElementById('correo-fiscal'),
      };
      const checkboxConfirma = document.getElementById('confirma-datos-fiscales');
      const errores = document.getElementById('error-datos-fiscales');

      limpiarError(errores);
      Object.values(campos).forEach(limpiarCampoInvalido);

      const rfcValor = campos.rfc.value.trim().toUpperCase();
      const cpValor = campos.codigoPostal.value.trim();
      const correoValor = campos.correo.value.trim();

      let primerCampoInvalido = null;
      const marcarSiVacio = function (input, condicionValida) {
        if (!condicionValida) {
          marcarCampoInvalido(input);
          if (!primerCampoInvalido) primerCampoInvalido = input;
        }
      };

      marcarSiVacio(campos.rfc, rfcValor.length >= 12 && rfcValor.length <= 13);
      marcarSiVacio(campos.razonSocial, campos.razonSocial.value.trim().length > 0);
      marcarSiVacio(campos.codigoPostal, /^\d{5}$/.test(cpValor));
      marcarSiVacio(campos.regimenFiscal, campos.regimenFiscal.value !== '');
      marcarSiVacio(campos.usoCfdi, campos.usoCfdi.value !== '');
      marcarSiVacio(campos.correo, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoValor));

      if (primerCampoInvalido) {
        mostrarError(errores, 'Revisa los campos marcados: falta información o el formato no es válido.');
        primerCampoInvalido.focus();
        return;
      }

      if (!checkboxConfirma.checked) {
        mostrarError(errores, 'Debes confirmar que tus datos fiscales son correctos para continuar.');
        checkboxConfirma.focus();
        return;
      }

      estado.datosFiscales = {
        rfc: rfcValor,
        razonSocial: campos.razonSocial.value.trim(),
        codigoPostal: cpValor,
        regimenFiscal: campos.regimenFiscal.options[campos.regimenFiscal.selectedIndex].textContent,
        usoCfdi: campos.usoCfdi.options[campos.usoCfdi.selectedIndex].textContent,
        correo: correoValor,
      };

      mostrarConfirmacion();
      irAPaso(4);
    }

    /* ---------- Paso 4: confirmación ---------- */
    function mostrarConfirmacion() {
      const pedido = estado.pedido;
      const fiscal = estado.datosFiscales;

      document.getElementById('conf-folio').textContent = pedido.folio;
      document.getElementById('conf-fecha').textContent = pedido.fechaLegible;
      document.getElementById('conf-subtotal').textContent = formatoMoneda(pedido.subtotal);
      document.getElementById('conf-iva').textContent = formatoMoneda(pedido.iva);
      document.getElementById('conf-total').textContent = formatoMoneda(pedido.total);

      document.getElementById('conf-rfc').textContent = fiscal.rfc;
      document.getElementById('conf-razon-social').textContent = fiscal.razonSocial;
      document.getElementById('conf-cp').textContent = fiscal.codigoPostal;
      document.getElementById('conf-regimen').textContent = fiscal.regimenFiscal;
      document.getElementById('conf-uso').textContent = fiscal.usoCfdi;
      document.getElementById('conf-correo').textContent = fiscal.correo;
    }

    const btnRegresarCorregir = document.getElementById('btn-regresar-corregir');
    if (btnRegresarCorregir) {
      btnRegresarCorregir.addEventListener('click', function () {
        irAPaso(3);
      });
    }

    const btnEmitirFactura = document.getElementById('btn-emitir-factura');
    if (btnEmitirFactura) {
      btnEmitirFactura.addEventListener('click', function () {
        irAPaso(5);
        simularTimbrado();
      });
    }

    /* ---------- Paso 5: procesando ---------- */
    function simularTimbrado() {
      // TODO(API): Reemplazar por la llamada real al backend / PAC:
      // const respuesta = await fetch('/api/facturas/timbrar', { method: 'POST', body: JSON.stringify({ pedido: estado.pedido, fiscal: estado.datosFiscales }) });
      // const factura = await respuesta.json();
      window.setTimeout(function () {
        mostrarFacturaGenerada(FACTURA_MOCK);
        irAPaso(6);
      }, 1500);
    }

    /* ---------- Paso 6: factura generada ---------- */
    function mostrarFacturaGenerada(factura) {
      document.getElementById('final-uuid').textContent = factura.uuid;
      document.getElementById('final-folio').textContent = factura.folio;
      document.getElementById('final-estado').textContent = factura.estado;
      document.getElementById('final-total').textContent = formatoMoneda(factura.total);
    }
  }

  /* ================================================================
     FLUJO: consultar-factura.html
     ================================================================ */

  function initConsultarFactura() {
    const form = document.getElementById('form-consultar-factura');
    if (!form) return; // esta página no es consultar-factura.html

    const inputFolio = document.getElementById('consulta-folio');
    const inputRfc = document.getElementById('consulta-rfc');
    const inputCorreo = document.getElementById('consulta-correo');
    const errores = document.getElementById('error-consulta-factura');
    const resultado = document.getElementById('resultado-consulta-factura');

    form.addEventListener('submit', function (evento) {
      evento.preventDefault();
      consultarFactura();
    });

    function consultarFactura() {
      limpiarError(errores);
      [inputFolio, inputRfc, inputCorreo].forEach(limpiarCampoInvalido);
      resultado.hidden = true;

      const folio = inputFolio.value.trim().toUpperCase();
      const rfc = inputRfc.value.trim().toUpperCase();
      const correo = inputCorreo.value.trim().toLowerCase();

      if (!folio || !rfc || !correo) {
        [
          [inputFolio, folio],
          [inputRfc, rfc],
          [inputCorreo, correo],
        ].forEach(function (par) {
          if (!par[1]) marcarCampoInvalido(par[0]);
        });
        mostrarError(errores, 'Completa folio, RFC y correo electrónico para realizar la consulta.');
        return;
      }

      // TODO(API): Reemplazar por consulta real, por ejemplo:
      // const respuesta = await fetch('/api/facturas/consultar', { method: 'POST', body: JSON.stringify({ folio, rfc, correo }) });
      const coincide =
        folio === FACTURA_MOCK.folio.toUpperCase() &&
        rfc === FACTURA_MOCK.rfc &&
        correo === FACTURA_MOCK.correo.toLowerCase();

      if (!coincide) {
        mostrarError(
          errores,
          'No encontramos una factura con los datos proporcionados. Verifica la información e inténtalo nuevamente.'
        );
        return;
      }

      document.getElementById('c-estado').textContent = FACTURA_MOCK.estado;
      document.getElementById('c-uuid').textContent = FACTURA_MOCK.uuid;
      document.getElementById('c-fecha').textContent = FACTURA_MOCK.fechaEmision;
      document.getElementById('c-total').textContent = formatoMoneda(FACTURA_MOCK.total);
      resultado.hidden = false;
      resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* ================================================================
     Botones de descarga PDF / XML — modo demostración
     (compartido por facturar.html y consultar-factura.html)
     ================================================================ */
  function initBotonesDescargaDemo() {
    document.querySelectorAll('[data-demo-download]').forEach(function (boton) {
      boton.addEventListener('click', function (evento) {
        evento.preventDefault();
        // No se genera ningún PDF ni XML real; es solo demostrativo.
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initFacturarFlow();
    initConsultarFactura();
    initBotonesDescargaDemo();
  });
})();