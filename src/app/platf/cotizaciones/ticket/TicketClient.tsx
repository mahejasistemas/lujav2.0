'use client';

import Image from 'next/image';
import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';

type Payload = {
  folio?: string;
  empresa?: string;
  cliente?: string;
  emitidaPor?: string;
  correoEmitente?: string;
  fechaEmision?: string;
  fechaCaducidad?: string;
  tarifaOrigen?: string;
  destino?: string;
  servicio?: string;
  divisa?: string;
  serviceBlocks?: unknown[];
  mixtaBlocks?: unknown[];
  cargas?: unknown[];
  lonas?: {
    aplica?: boolean;
    metros?: string;
    largo?: string;
    ancho?: string;
    alto?: string;
    monto?: string;
  };
  seguro?: {
    aplica?: boolean;
    monto?: string;
  };
  montos?: {
    servicios?: Array<{
      index: number;
      label: string;
      tariffType?: string;
      cargasCount: number;
      cantidadTotal: number;
      unitPrice: number;
      subtotal: number;
    }>;
    cargas?: Array<{
      index: number;
      serviceIndex: number;
      cantidad: number;
      largo?: string;
      ancho?: string;
      alto?: string;
      peso?: string;
      unitPrice: number;
      lineTotal: number;
    }>;
    extras?: { lonas?: number; seguro?: number; tolvas?: number; total?: number };
    total?: number;
  };
};

function money(n: number, ccy: string) {
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: ccy || 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n || 0);
  } catch {
    return `${(n || 0).toFixed(2)} ${ccy || 'MXN'}`;
  }
}

function decodeBase64Utf8(b64: string) {
  try {
    if (typeof atob === 'function') {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
    const buf = (
      globalThis as unknown as {
        Buffer?: { from: (input: string, encoding: 'base64') => Uint8Array };
      }
    ).Buffer;
    if (buf) {
      const bytes = Uint8Array.from(buf.from(b64, 'base64'));
      return new TextDecoder().decode(bytes);
    }
    return '';
  } catch {
    return '';
  }
}

function formatDate(date: string | undefined) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function formatCurrency(amount: number, ccy: string) {
  return money(amount, ccy);
}

type CargoItem = {
  id: string;
  description?: string;
  quantity?: number | string;
  weight?: number | string;
  length?: number | string;
  width?: number | string;
  height?: number | string;
  cantidad?: string;
  largo?: string;
  ancho?: string;
  alto?: string;
  peso?: string;
};

function Editable({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      className={`cursor-text rounded px-0.5 outline-none transition-colors hover:bg-red-50 focus:bg-red-50 ${className}`}
    >
      {children}
    </span>
  );
}

export default function TicketClient() {
  const sp = useSearchParams();
  const decoded: Payload | null = useMemo(() => {
    const d = sp.get('d');
    if (!d) return null;
    try {
      const json = decodeBase64Utf8(d);
      return JSON.parse(json);
    } catch {
      return null;
    }
  }, [sp]);

  useEffect(() => {
    const auto = sp.get('auto');
    if (auto === '1') {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [sp]);

  if (!decoded) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-2xl border border-black/10 bg-white p-6">
          <div className="text-lg font-semibold text-zinc-900">Sin datos</div>
          <div className="mt-2 text-sm text-zinc-600">
            Abre este ticket desde la Hoja de cotización.
          </div>
        </div>
      </div>
    );
  }

  const ccy = decoded.divisa || 'MXN';
  const servicios = decoded.montos?.servicios || [];
  const cargasMontos = decoded.montos?.cargas || [];
  const extras =
    decoded.montos?.extras ||
    ({} as { lonas?: number; seguro?: number; tolvas?: number; total?: number });
  const totalSinImpuestos = decoded.montos?.total || 0;
  const extrasLonas = extras.lonas || 0;
  const extrasSeguro = extras.seguro || 0;
  const extrasTolvas = extras.tolvas || 0;
  const extrasTotal = extras.total || extrasLonas + extrasSeguro + extrasTolvas;
  const basePrice = Math.max(0, totalSinImpuestos - extrasTotal);
  const subtotal = basePrice + extrasTotal;
  const iva = subtotal * 0.16;
  const retencion = subtotal * 0.04;
  const total = subtotal + iva - retencion;
  const equipment =
    (servicios[0]?.label as string | undefined) ||
    (decoded.servicio ? String(decoded.servicio) : '') ||
    'General';
  const tiempoCarga = '24 hrs libres';
  const items: CargoItem[] = Array.isArray(decoded.cargas)
    ? (decoded.cargas as CargoItem[]).map((x, idx) => ({
        id: String((x as CargoItem).id ?? idx),
        description: (x as CargoItem).description,
        quantity: (x as CargoItem).quantity,
        cantidad: (x as CargoItem).cantidad,
        largo: (x as CargoItem).largo,
        ancho: (x as CargoItem).ancho,
        alto: (x as CargoItem).alto,
        peso: (x as CargoItem).peso,
      }))
    : cargasMontos.map((c) => ({
        id: String(c.index),
        cantidad: String(c.cantidad ?? ''),
        largo: c.largo,
        ancho: c.ancho,
        alto: c.alto,
        peso: c.peso,
      }));

  return (
    <div className="w-full bg-white p-8 text-[11px] leading-tight text-black print:m-0 print:p-0 printable-content">
      <style jsx global>{`
        @media print {
          @page {
            margin: 10mm;
            size: auto;
          }
          body {
            visibility: hidden;
            background-color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .printable-content {
            visibility: visible;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0 !important;
            padding: 0 !important;
          }
          .printable-content * {
            visibility: visible;
          }
          .bg-red-600 {
            background-color: #dc2626 !important;
            color: white !important;
          }
          .bg-red-100 {
            background-color: #fee2e2 !important;
            color: #7f1d1d !important;
          }
          .bg-red-50 {
            background-color: #fef2f2 !important;
            color: #7f1d1d !important;
          }
          [role='dialog'] {
            position: static !important;
            background: white !important;
          }
        }
      `}</style>

      <div className="mb-6 flex items-center justify-between border-b pb-4">
        <div className="w-1/3">
          <div className="relative mb-2 h-24 w-64">
            <Image
              src="/logolujav.png"
              alt="Transportes Lujav"
              fill
              className="object-contain object-left"
              priority
            />
          </div>
        </div>

        <div className="w-1/2 space-y-1 text-center">
          <div className="mb-2 text-lg font-bold">
            <Editable>COTIZACIÓN</Editable>
          </div>
          <div className="grid grid-cols-2 gap-x-4 text-right text-[11px]">
            <div className="font-bold text-gray-600">
              <Editable>Fecha / Date:</Editable>
            </div>
            <div className="text-left">
              <Editable>{formatDate(decoded.fechaEmision)}</Editable>
            </div>

            <div className="font-bold text-gray-600">
              <Editable>Num. De cotización / Quote No:</Editable>
            </div>
            <div className="text-left">
              <Editable>{decoded.folio || ''}</Editable>
            </div>

            <div className="font-bold text-gray-600">
              <Editable>Vigencia / Validity:</Editable>
            </div>
            <div className="text-left">
              <Editable>{formatDate(decoded.fechaCaducidad)}</Editable>
            </div>

            <div className="font-bold text-gray-600">
              <Editable>Moneda / Currency:</Editable>
            </div>
            <div className="text-left">
              <Editable>{ccy}</Editable>
            </div>

            <div className="font-bold text-gray-600">
              <Editable>Correo / Email:</Editable>
            </div>
            <div className="break-all text-left">
              <Editable>contacto@transporteslujav.com</Editable>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex justify-between gap-8">
        <div className="w-1/2 space-y-1">
          <h3 className="mb-2 border-b border-gray-300 text-sm font-bold">
            <Editable>EMISOR / ISSUER</Editable>
          </h3>
          <div className="font-bold">
            <Editable>NELLY TRESS TAKAHASHI</Editable>
          </div>
          <div>
            <Editable>RFC: TETN680531TJ6</Editable>
          </div>
          <div>
            <Editable>Carr. Libramiento Santa Fe San Julian Km. 3.7</Editable>
          </div>
          <div>
            <Editable>Col. Nueva Dr. Delfino A. Victoria, 91690</Editable>
          </div>
          <div>
            <Editable>Veracruz, Ver.</Editable>
          </div>
          <div>
            <Editable>Cel. 924 242 7410, 924 102 5856</Editable>
          </div>
        </div>

        <div className="w-1/2 space-y-1">
          <h3 className="mb-2 border-b border-gray-300 text-sm font-bold">
            <Editable>CLIENTE / CLIENT</Editable>
          </h3>
          <div className="grid grid-cols-[100px_1fr] gap-1">
            <div className="font-bold">
              <Editable>Cliente:</Editable>
            </div>
            <div className="uppercase">
              <Editable>{decoded.cliente || decoded.empresa || 'Cliente General'}</Editable>
            </div>

            <div className="font-bold">
              <Editable>Presupuesto:</Editable>
            </div>
            <div>
              <Editable>{decoded.folio || ''}</Editable>
            </div>

            <div className="font-bold">
              <Editable>Empresa:</Editable>
            </div>
            <div className="uppercase">
              <Editable>{decoded.empresa || 'Cliente General'}</Editable>
            </div>

            <div className="font-bold">
              <Editable>Vendedor:</Editable>
            </div>
            <div>
              <Editable>{decoded.emitidaPor || '—'}</Editable>
            </div>

            <div className="font-bold">
              <Editable>Moneda:</Editable>
            </div>
            <div>
              <Editable>{ccy}</Editable>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="mb-2 bg-red-100 p-1 text-sm font-bold text-red-900">
          <Editable>DESCRIPCIÓN DEL SERVICIO / SERVICE DESCRIPTION</Editable>
        </h3>
        <table className="w-full border-collapse border border-gray-300 text-center text-[11px]">
          <thead className="bg-red-600 font-bold text-white">
            <tr>
              <th className="border border-gray-300 p-2">
                <Editable>Origen / Origin</Editable>
              </th>
              <th className="border border-gray-300 p-2">
                <Editable>Destino / Destination</Editable>
              </th>
              <th className="border border-gray-300 p-2">
                <Editable>Carga / Cargo</Editable>
              </th>
              <th className="border border-gray-300 p-2">
                <Editable>Equipo / Equipment</Editable>
              </th>
              <th className="border border-gray-300 p-2">
                <Editable>Tipo de carga / Cargo Type</Editable>
              </th>
            </tr>
          </thead>
          <tbody>
            {(items.length > 0 ? items : [{ id: 'default' } as CargoItem]).map(
              (it, index) => {
                const qty = it.cantidad || it.quantity || 1;
                const desc = it.description ? it.description : `${qty} Bultos`;
                const dims =
                  it.largo && it.ancho && it.alto
                    ? `(${it.largo}m x ${it.ancho}m x ${it.alto}m)`
                    : '';
                const fullDesc = `${desc} ${dims}`.trim();
                return (
                  <tr key={`${index}-${String(qty)}`}>
                    <td className="border border-gray-300 p-2">
                      <Editable>{decoded.tarifaOrigen || ''}</Editable>
                    </td>
                    <td className="border border-gray-300 p-2">
                      <Editable>{decoded.destino || ''}</Editable>
                    </td>
                    <td className="border border-gray-300 p-2">
                      <Editable>{fullDesc || 'General'}</Editable>
                    </td>
                    <td className="border border-gray-300 p-2 uppercase">
                      <Editable>{equipment}</Editable>
                    </td>
                    <td className="border border-gray-300 p-2 uppercase">
                      <Editable>{decoded.servicio ? String(decoded.servicio) : 'General'}</Editable>
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>

      <div className="mb-6">
        <h3 className="mb-2 bg-red-100 p-1 text-sm font-bold text-red-900">
          <Editable>PROPUESTA ECONÓMICA / ECONOMIC PROPOSAL</Editable>
        </h3>
        <table className="w-full border-collapse border border-gray-300 text-center text-[11px]">
          <thead className="bg-red-600 font-bold text-white">
            <tr>
              <th className="border border-gray-300 p-2">
                <Editable>Cantidad / Qty</Editable>
              </th>
              <th className="border border-gray-300 p-2 w-1/3">
                <Editable>Descripción / Description</Editable>
              </th>
              <th className="border border-gray-300 p-2">
                <Editable>Tiempo Carga/Descarga Loading Time</Editable>
              </th>
              <th className="border border-gray-300 p-2">
                <Editable>Costo Unitario / Unit Cost</Editable>
              </th>
              <th className="border border-gray-300 p-2">
                <Editable>Impuestos / Taxes</Editable>
              </th>
              <th className="border border-gray-300 p-2">
                <Editable>Tarifa / Rate</Editable>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 p-2">
                <Editable>1</Editable>
              </td>
              <td className="border border-gray-300 p-2 text-left">
                <Editable>Servicio de Flete Terrestre</Editable>
                <br />
                <Editable>
                  {decoded.tarifaOrigen || ''} - {decoded.destino || ''}
                </Editable>
              </td>
              <td className="border border-gray-300 p-2">
                <Editable>{tiempoCarga}</Editable>
              </td>
              <td className="border border-gray-300 p-2">
                <Editable>{formatCurrency(basePrice, ccy)}</Editable>
              </td>
              <td className="border border-gray-300 p-2">
                <Editable>IVA 16% RET 4%</Editable>
              </td>
              <td className="border border-gray-300 p-2">
                <Editable>{formatCurrency(basePrice, ccy)}</Editable>
              </td>
            </tr>
            {extrasTolvas > 0 ? (
              <tr>
                <td className="border border-gray-300 p-2">
                  <Editable>1</Editable>
                </td>
                <td className="border border-gray-300 p-2 text-left">
                  <Editable>Servicio Tolva (Adicional)</Editable>
                </td>
                <td className="border border-gray-300 p-2">
                  <Editable>{tiempoCarga}</Editable>
                </td>
                <td className="border border-gray-300 p-2">
                  <Editable>{formatCurrency(extrasTolvas, ccy)}</Editable>
                </td>
                <td className="border border-gray-300 p-2">
                  <Editable>IVA 16% RET 4%</Editable>
                </td>
                <td className="border border-gray-300 p-2">
                  <Editable>{formatCurrency(extrasTolvas, ccy)}</Editable>
                </td>
              </tr>
            ) : null}
            {extrasLonas > 0 ? (
              <tr>
                <td className="border border-gray-300 p-2">
                  <Editable>1</Editable>
                </td>
                <td className="border border-gray-300 p-2 text-left">
                  <Editable>Lonas (Adicional)</Editable>
                </td>
                <td className="border border-gray-300 p-2">
                  <Editable>{tiempoCarga}</Editable>
                </td>
                <td className="border border-gray-300 p-2">
                  <Editable>{formatCurrency(extrasLonas, ccy)}</Editable>
                </td>
                <td className="border border-gray-300 p-2">
                  <Editable>IVA 16% RET 4%</Editable>
                </td>
                <td className="border border-gray-300 p-2">
                  <Editable>{formatCurrency(extrasLonas, ccy)}</Editable>
                </td>
              </tr>
            ) : null}
            {extrasSeguro > 0 ? (
              <tr>
                <td className="border border-gray-300 p-2">
                  <Editable>1</Editable>
                </td>
                <td className="border border-gray-300 p-2 text-left">
                  <Editable>Seguro de carga (Adicional)</Editable>
                </td>
                <td className="border border-gray-300 p-2">
                  <Editable>{tiempoCarga}</Editable>
                </td>
                <td className="border border-gray-300 p-2">
                  <Editable>{formatCurrency(extrasSeguro, ccy)}</Editable>
                </td>
                <td className="border border-gray-300 p-2">
                  <Editable>IVA 16% RET 4%</Editable>
                </td>
                <td className="border border-gray-300 p-2">
                  <Editable>{formatCurrency(extrasSeguro, ccy)}</Editable>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mb-8 flex justify-end">
        <div className="w-1/3">
          <table className="w-full border-collapse border border-gray-300 text-right text-[11px]">
            <tbody>
              <tr>
                <td className="bg-red-50 p-2 font-bold text-red-900 border border-gray-300">
                  <Editable>SUBTOTAL</Editable>
                </td>
                <td className="border border-gray-300 p-2">
                  <Editable>{formatCurrency(subtotal, ccy)}</Editable>
                </td>
              </tr>
              <tr>
                <td className="bg-red-50 p-2 font-bold text-red-900 border border-gray-300">
                  <Editable>Tasa Impositiva (16%)</Editable>
                </td>
                <td className="border border-gray-300 p-2">
                  <Editable>16.00%</Editable>
                </td>
              </tr>
              <tr>
                <td className="bg-red-50 p-2 font-bold text-red-900 border border-gray-300">
                  <Editable>Impuesto Ventas (IVA)</Editable>
                </td>
                <td className="border border-gray-300 p-2">
                  <Editable>{formatCurrency(iva, ccy)}</Editable>
                </td>
              </tr>
              <tr>
                <td className="bg-red-50 p-2 font-bold text-red-900 border border-gray-300">
                  <Editable>RET. de Fletes (4%)</Editable>
                </td>
                <td className="border border-gray-300 p-2 text-red-600">
                  - <Editable>{formatCurrency(retencion, ccy)}</Editable>
                </td>
              </tr>
              <tr className="border-t-2 border-black">
                <td className="bg-red-600 p-2 text-sm font-bold text-white border border-gray-300">
                  <Editable>TOTAL</Editable>
                </td>
                <td className="border border-gray-300 p-2 text-sm font-bold">
                  <Editable>{formatCurrency(total, ccy)}</Editable>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4 border-t pt-4 text-[10px] text-justify">
        <h4 className="text-xs font-bold uppercase">
          <Editable>Cláusulas / Clauses:</Editable>
        </h4>
        <ol className="list-decimal list-outside space-y-1 pl-4 text-gray-700">
          <li>
            <Editable>
              NO INCLUYE NINGUN TIPO DE SEGURO DE MERCANCIA, SE TRANSPORTA POR CUENTA Y RIESGO DEL CLIENTE, NUESTRA RESPONSABILIDAD QUEDA LIMITADA A LA CLAUSULA NOVENA DE LAS CONDICIONES DEL CONTRATO DE TRANSPORTE AL REVERSO DE LA CARTA PORTE.
            </Editable>
          </li>
          <li>
            <Editable>
              EN CASO DE ASIGNAR EL PROYECTO A NUESTRA EMPRESA, SI EL CLIENTE CAMBIA FECHA PLANEADA DE CARGAS, NOS RESERVAMOS EL DERECHO DE CAMBIAR FECHAS Y CONDICIONES EN INICIO DEL PROYECTO.
            </Editable>
          </li>
          <li>
            <Editable>
              TODA REFACTURACION SOLICITADA POR EL CLIENTE, DEBIDO A ERRORES DE INFORMACION NO COTEJADOS DESDE LA SOLICITUD DEL SERVICIO GENERARÁ UN COSTO EXTRA DE $ 1,000.00 MAS IVA.
            </Editable>
          </li>
          <li>
            <Editable>LOS SERVICIOS REALIZADOS EN TERRITORIO MEXICANO SON MAS IMPUESTOS.</Editable>
          </li>
          <li>
            <Editable>EL PRECIO DE ESTA COTIZACION ES SOLO POR 30 DIAS A PARTIR DE LA FECHA DE SU EXPEDICION.</Editable>
          </li>
          <li>
            <Editable>
              LA MERCANCIA SERA CARGADA SEGÚN LOS PUNTOS DE GRAVEDAD Y ESPECIFICACIONES DE LAS CARGAS QUE EL CLIENTE OTORGUE, NO SOMOS RESPONSABLES DE CUALQUIER PERCANCE POR OMISIONES DE ESTA INDOLE.
            </Editable>
          </li>
          <li>
            <Editable>
              NUESTRO PERSONAL SE APEGARA AL PLAN DE EMBARQUE ESPECIFICADO DE COMUN ACUERDO, POR LO TANTO, NO SOMOS RESPONSABLES DE CAULQUIER RETRASO O DEMORA POR FALTA DE ALGUN DOCUMENTO, HUELGA, INCLEMENCIA DE TIEMPO, DISTURBIO SOCIAL, PERIODOS DE INACTIVIDAD PROVOCADOS POR SITUACIONES AJENAS A NUESTRO EQUIPO DE TRABAJO, EN CASO DE INCURRIR EN ESTO, SE CONSIDERAN DEMORAS.
            </Editable>
          </li>
          <li>
            <Editable>FLETE EN FALSO COSTO 70% COSTO DE SERVICIO.</Editable>
          </li>
          <li>
            <Editable>LA RUTA PARA TOMAR SON DECISION DE NUESTRO EQUIPO Y PERSONAL AUTORIZDO O SCT.</Editable>
          </li>
          <li>
            <Editable>LOS SERVICIOS INCLUYEN PERSONAL Y UNIDADES PILOTO EN EL CASO DE SER REQUERIDOS POR LA SCT.</Editable>
          </li>
          <li>
            <Editable>
              EN CASO DE MERCANCIAS USADAS NO NOS HACEMOS RESPONSABLES POR DAÑOS OCULTOS O VISIBLES. EL USUARIO ACEPTA EL RIESGO.
            </Editable>
          </li>
          <li>
            <Editable>
              ESTA COTIZACION INCLUYE PERMISOS, UNIDADES PILOTO, AMARRES, CADENAS, AUTOPISTAS.
            </Editable>
          </li>
          <li>
            <Editable>NO INCLUYE MANIOBRAS DE CARGA Y/O DESCARGA.</Editable>
          </li>
          <li>
            <Editable>
              NO INCLUYE LIBRANZAS, ADECUACIONES, CONSTRUCCIONES DE CAMINOS, ETC. QUE REQUIERA LA RUTA PARA LA TRANSPORTACION. ESTE COSTO ES UNICAMENTE POR EL TRANSPORTE DESDE EL LUGAR INDICADO COMO ORIGEN HASTA EL SITIO DE ACOPIO Y/O PUNTO INDICADO COMO DESTINO QUE ESTE EN CONDICIONES DE DESCARGA EN PARQUES EOLICOS.
            </Editable>
          </li>
          <li>
            <Editable>
              LA RESPONSABILIDAD DE MEJORAS, FABRICACIONES DE CAMINOS, ACCESOS, ETC. SON RESPONSABILIDAD DEL CLIENTE Y DEBERAN CUMPLIR Y ESTAR ACORDES A LOS REQUERIMIENTOS MINIMOS PRESENTADOS TANTO EN RADIO DE GIRO, CURVAS VERTICALES Y PENDIENTES.
            </Editable>
          </li>
          <li>
            <Editable>
              SE TIENE EL DERECHO TOTAL Y ABSOLUTO SOBRE TODA LA DIFUSION FOTOGRAFICA, AUDIOVISUAL DE LOS SERVICIOS DE TRANSPORTE. SON EXCLUSIVIDAD DE TRANSPORTES LUJAV.
            </Editable>
          </li>
          <li>
            <Editable>
              NUESTRO SERVICIO INCLUYE MONITOREO GPS HASTA LA ENTREGA DE SU CARGA EN DESTINO.
            </Editable>
          </li>
          <li>
            <Editable>
              LA ACEPTACION DEL SERVICIO IMPLICA LA ACEPTACION TACITA DE LAS CONDICIONES QUE AQUÍ SE EXPRESAN.
            </Editable>
          </li>
        </ol>

        <div className="mt-4 grid grid-cols-2 gap-8 border-t border-gray-200 pt-4">
          <div>
            <p className="mb-2 font-bold">
              <Editable>Si tiene alguna duda sobre este presupuesto, póngase en contacto con:</Editable>
            </p>
            <div className="space-y-1">
              <p>
                <Editable>Ing. Lucio Javier Padua Tress - Cel. 924 242 7410</Editable>
              </p>
              <p>
                <Editable>Natalia García Arroyo - Cel. 922 106 1826</Editable>
              </p>
              <p>
                <Editable>Omar Moises Reyes del Valle - Cel. 229 520 7062</Editable>
              </p>
            </div>
            <p className="mt-2 italic">
              <Editable>Gracias por su confianza.</Editable>
            </p>
          </div>

          <div className="rounded border border-gray-200 bg-gray-50 p-3">
            <h5 className="mb-2 border-b border-gray-300 pb-1 font-bold">
              <Editable>DATOS BANCARIOS</Editable>
            </h5>
            <div className="grid grid-cols-[120px_1fr] gap-1">
              <div className="font-semibold">
                <Editable>BANCO:</Editable>
              </div>
              <div>
                <Editable>SANTANDER</Editable>
              </div>
              <div className="font-semibold">
                <Editable>CLAVE INTERB.:</Editable>
              </div>
              <div>
                <Editable>014849655033158880</Editable>
              </div>
              <div className="font-semibold">
                <Editable>CUENTA:</Editable>
              </div>
              <div>
                <Editable>065503315888</Editable>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t-2 border-black pt-4">
          <p className="mb-2 font-bold text-red-600">
            <Editable>NOTAS IMPORTANTES:</Editable>
          </p>
          <ul className="list-disc space-y-1 pl-5 text-gray-600">
            <li>
              <Editable>
                LOS SIGUIENTES CARGOS SE APLICARAN SI ES NECESARIO, ADICIONAL A LOS DEMAS CARGOS APLICABLES.
              </Editable>
            </li>
            <li>
              <Editable>
                LA EMPRESA TRANSPORTES LUJAV SE DESLINDA DE CUALQUIER RESPONSABILIDAD RESPECTO DE PERSONAS AJENAS ENVIADAS POR EL SOLICITANTE QUE ACOMPAÑE AL OPERADOR EN LA UNIDAD CONTRATADA.
              </Editable>
            </li>
            <li>
              <Editable>
                SI EL SOLICITANTE PROPORCIONA A LA EMPRESA TRANSPORTES LUJAV, PESOS Y MEDIDAS INCORRECTAS DE SU MERCANCIA A TRANSPORTAR, EL SOLICITANTE SE OBLIGA A PAGAR LAS INFRACCIONES Y MULTAS CORRESPONDIENTES.
              </Editable>
            </li>
          </ul>
        </div>

        <div className="mt-8">
          <p className="mb-8 px-8 text-center italic">
            <Editable>
              ESTIMADO CLIENTE PARA ORDENAR EL SERVICIO AQUÍ ESPECIFICADO, LE AGRADECEMOS DEVOLVERLO FIRMADO CON SU AUTORIZACION, COMO QUE YA A FALTA DE ESTE RESQUISITO NO SE PODRA EFECTUAR EL SERVICIO.
            </Editable>
          </p>

          <div className="mt-16 flex items-end justify-between px-12">
            <div className="text-center">
              <div className="mx-auto mb-2 w-48 border-t border-black" />
              <div className="font-bold">
                <Editable>CLIENTE</Editable>
              </div>
              <div className="mt-1 text-xs uppercase">
                <Editable>{decoded.empresa || 'Cliente General'}</Editable>
              </div>
              <div className="mt-1 text-[9px]">
                <Editable>FIRMA DE CONFORMIDAD</Editable>
              </div>
            </div>

            <div className="text-center">
              <div className="mb-1 font-bold">
                <Editable>NELLY TRESS TAKAHASHI</Editable>
              </div>
              <div className="mx-auto mb-2 w-48 border-t border-black" />
              <div className="font-bold">
                <Editable>TRANSPORTES LUJAV</Editable>
              </div>
              <div className="text-[9px]">
                <Editable>ING. LUCIO JAVIER PADUA TRESS</Editable>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
