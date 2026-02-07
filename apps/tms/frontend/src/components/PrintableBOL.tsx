import { useRef } from 'react'
import { Printer, Download, X } from 'lucide-react'

interface BOLData {
  bol_number: string
  date: string
  bol_type?: string

  shipper: {
    name: string
    address: string
    city: string
    state: string
    zip: string
    contact?: string
    phone?: string
    sid_number?: string
    fob?: string
  }

  consignee: {
    name: string
    address: string
    city: string
    state: string
    zip: string
    contact?: string
    phone?: string
    location_number?: string
  }

  third_party?: {
    name: string
    address?: string
    city?: string
    state?: string
    zip?: string
  }

  carrier: {
    name: string
    mc_number?: string
    dot_number?: string
    scac_code?: string
    trailer_number?: string
    seal_number?: string
    pro_number?: string
  }

  freight_items?: {
    handling_unit_qty?: number
    handling_unit_type?: string
    package_qty?: number
    package_type?: string
    weight_lbs?: number
    hazmat?: boolean
    hazmat_class?: string
    hazmat_un_number?: string
    hazmat_packing_group?: string
    commodity_description?: string
    nmfc_number?: string
    freight_class?: string
  }[]

  commodity?: string
  weight_lbs?: number
  equipment_type?: string
  pickup_date?: string
  delivery_date?: string
  special_instructions?: string
  reference_numbers?: string[]
  pieces?: number
  prepaid_or_collect?: string
  cod_amount?: number
  declared_value?: number
  hazmat?: boolean

  [key: string]: unknown
}

interface PrintableBOLProps {
  bolData: BOLData
  bolId: string
  onClose: () => void
}

export default function PrintableBOL({ bolData, bolId, onClose }: PrintableBOLProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    const content = printRef.current
    if (!content) return

    const printWindow = window.open('', '_blank', 'width=800,height=1100')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>BOL ${bolData.bol_number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #000; padding: 20px; }
            table { border-collapse: collapse; width: 100%; }
            td, th { border: 1px solid #000; padding: 4px 6px; text-align: left; vertical-align: top; }
            .header { text-align: center; font-size: 14px; font-weight: bold; border: 2px solid #000; padding: 8px; margin-bottom: 2px; }
            .section-header { background: #f0f0f0; font-weight: bold; font-size: 9px; text-transform: uppercase; padding: 3px 6px; }
            .label { font-weight: bold; font-size: 8px; color: #444; text-transform: uppercase; }
            .value { font-size: 11px; min-height: 14px; }
            .no-border { border: none; }
            .bold { font-weight: bold; }
            .center { text-align: center; }
            .right { text-align: right; }
            .signature-line { border-top: 1px solid #000; margin-top: 20px; padding-top: 4px; font-size: 8px; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${content.innerHTML}
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const freightItems = bolData.freight_items || [
    {
      handling_unit_qty: bolData.pieces || 1,
      handling_unit_type: 'PLT',
      package_qty: bolData.pieces || 1,
      package_type: 'PLT',
      weight_lbs: bolData.weight_lbs,
      hazmat: bolData.hazmat || false,
      commodity_description: bolData.commodity || '',
      nmfc_number: '',
      freight_class: '',
    },
  ]

  const totalWeight = freightItems.reduce((sum, item) => sum + (item.weight_lbs || 0), 0)
  const totalPieces = freightItems.reduce((sum, item) => sum + (item.handling_unit_qty || 0), 0)

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50 rounded-t-xl">
          <h3 className="font-semibold text-gray-900">Bill of Lading - {bolData.bol_number}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* BOL Document */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          <div ref={printRef} style={{ maxWidth: '750px', margin: '0 auto' }}>
            {/* Header */}
            <div className="header" style={{ border: '2px solid #000', textAlign: 'center', padding: '8px', marginBottom: '2px', fontSize: '14px', fontWeight: 'bold' }}>
              STRAIGHT BILL OF LADING - SHORT FORM - ORIGINAL - NOT NEGOTIABLE
            </div>

            {/* Top Info Row */}
            <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '0' }}>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', width: '50%' }}>
                    <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#444', textTransform: 'uppercase' as const }}>Date:</span>
                    <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{bolData.date}</div>
                  </td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', width: '50%' }}>
                    <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#444', textTransform: 'uppercase' as const }}>BOL Number:</span>
                    <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{bolData.bol_number}</div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Ship From / Ship To */}
            <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '0' }}>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '6px', width: '50%', verticalAlign: 'top' }}>
                    <div style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' as const, background: '#f0f0f0', margin: '-6px -6px 4px', padding: '3px 6px' }}>
                      Ship From (Shipper)
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{bolData.shipper.name}</div>
                    <div style={{ fontSize: '10px' }}>{bolData.shipper.address}</div>
                    <div style={{ fontSize: '10px' }}>{bolData.shipper.city}, {bolData.shipper.state} {bolData.shipper.zip}</div>
                    {bolData.shipper.contact && (
                      <div style={{ fontSize: '9px', marginTop: '4px' }}>Contact: {bolData.shipper.contact} {bolData.shipper.phone && `| ${bolData.shipper.phone}`}</div>
                    )}
                    {bolData.shipper.sid_number && (
                      <div style={{ fontSize: '9px' }}>SID#: {bolData.shipper.sid_number}</div>
                    )}
                    <div style={{ fontSize: '9px', marginTop: '2px' }}>FOB: {bolData.shipper.fob === 'destination' ? 'Destination' : 'Origin'}</div>
                  </td>
                  <td style={{ border: '1px solid #000', padding: '6px', width: '50%', verticalAlign: 'top' }}>
                    <div style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' as const, background: '#f0f0f0', margin: '-6px -6px 4px', padding: '3px 6px' }}>
                      Ship To (Consignee)
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{bolData.consignee.name}</div>
                    <div style={{ fontSize: '10px' }}>{bolData.consignee.address}</div>
                    <div style={{ fontSize: '10px' }}>{bolData.consignee.city}, {bolData.consignee.state} {bolData.consignee.zip}</div>
                    {bolData.consignee.contact && (
                      <div style={{ fontSize: '9px', marginTop: '4px' }}>Contact: {bolData.consignee.contact} {bolData.consignee.phone && `| ${bolData.consignee.phone}`}</div>
                    )}
                    {bolData.consignee.location_number && (
                      <div style={{ fontSize: '9px' }}>Location#: {bolData.consignee.location_number}</div>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Third Party / Carrier Info */}
            <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '0' }}>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '6px', width: '50%', verticalAlign: 'top' }}>
                    <div style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' as const, background: '#f0f0f0', margin: '-6px -6px 4px', padding: '3px 6px' }}>
                      Third Party Freight Charges Bill To
                    </div>
                    {bolData.third_party ? (
                      <>
                        <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{bolData.third_party.name}</div>
                        {bolData.third_party.address && <div style={{ fontSize: '10px' }}>{bolData.third_party.address}</div>}
                        {bolData.third_party.city && (
                          <div style={{ fontSize: '10px' }}>{bolData.third_party.city}, {bolData.third_party.state} {bolData.third_party.zip}</div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: '10px', color: '#888' }}>N/A</div>
                    )}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '6px', width: '50%', verticalAlign: 'top' }}>
                    <div style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' as const, background: '#f0f0f0', margin: '-6px -6px 4px', padding: '3px 6px' }}>
                      Carrier Information
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{bolData.carrier.name || '_______________'}</div>
                    <div style={{ fontSize: '9px' }}>
                      {bolData.carrier.mc_number && <span>MC#: {bolData.carrier.mc_number} </span>}
                      {bolData.carrier.dot_number && <span>DOT#: {bolData.carrier.dot_number} </span>}
                      {bolData.carrier.scac_code && <span>SCAC: {bolData.carrier.scac_code}</span>}
                    </div>
                    <div style={{ fontSize: '9px', marginTop: '2px' }}>
                      {bolData.carrier.trailer_number && <span>Trailer#: {bolData.carrier.trailer_number} </span>}
                      {bolData.carrier.seal_number && <span>Seal#: {bolData.carrier.seal_number} </span>}
                    </div>
                    {bolData.carrier.pro_number && (
                      <div style={{ fontSize: '9px' }}>PRO#: {bolData.carrier.pro_number}</div>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Reference Numbers */}
            {bolData.reference_numbers && bolData.reference_numbers.length > 0 && (
              <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '0' }}>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>
                      <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#444', textTransform: 'uppercase' as const }}>Reference Numbers: </span>
                      <span style={{ fontSize: '10px' }}>{bolData.reference_numbers.join(', ')}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}

            {/* Freight Details Table */}
            <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '0' }}>
              <thead>
                <tr style={{ background: '#f0f0f0' }}>
                  <th style={{ border: '1px solid #000', padding: '3px 6px', fontSize: '8px', textTransform: 'uppercase' as const, width: '8%' }}>HU Qty</th>
                  <th style={{ border: '1px solid #000', padding: '3px 6px', fontSize: '8px', textTransform: 'uppercase' as const, width: '8%' }}>HU Type</th>
                  <th style={{ border: '1px solid #000', padding: '3px 6px', fontSize: '8px', textTransform: 'uppercase' as const, width: '8%' }}>Pkg Qty</th>
                  <th style={{ border: '1px solid #000', padding: '3px 6px', fontSize: '8px', textTransform: 'uppercase' as const, width: '8%' }}>Pkg Type</th>
                  <th style={{ border: '1px solid #000', padding: '3px 6px', fontSize: '8px', textTransform: 'uppercase' as const, width: '10%' }}>Weight (lbs)</th>
                  <th style={{ border: '1px solid #000', padding: '3px 6px', fontSize: '8px', textTransform: 'uppercase' as const, width: '4%', textAlign: 'center' }}>HM</th>
                  <th style={{ border: '1px solid #000', padding: '3px 6px', fontSize: '8px', textTransform: 'uppercase' as const, width: '34%' }}>Commodity Description</th>
                  <th style={{ border: '1px solid #000', padding: '3px 6px', fontSize: '8px', textTransform: 'uppercase' as const, width: '10%' }}>NMFC#</th>
                  <th style={{ border: '1px solid #000', padding: '3px 6px', fontSize: '8px', textTransform: 'uppercase' as const, width: '10%' }}>Class</th>
                </tr>
              </thead>
              <tbody>
                {freightItems.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: '10px', textAlign: 'center' }}>{item.handling_unit_qty || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: '10px', textAlign: 'center' }}>{item.handling_unit_type || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: '10px', textAlign: 'center' }}>{item.package_qty || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: '10px', textAlign: 'center' }}>{item.package_type || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: '10px', textAlign: 'right' }}>{item.weight_lbs ? item.weight_lbs.toLocaleString() : ''}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: '10px', textAlign: 'center' }}>{item.hazmat ? 'X' : ''}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: '10px' }}>
                      {item.commodity_description}
                      {item.hazmat && item.hazmat_class && (
                        <div style={{ fontSize: '8px', color: '#c00', marginTop: '2px' }}>
                          HAZMAT - Class: {item.hazmat_class} UN#: {item.hazmat_un_number} PG: {item.hazmat_packing_group}
                        </div>
                      )}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: '10px', textAlign: 'center' }}>{item.nmfc_number || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: '10px', textAlign: 'center' }}>{item.freight_class || ''}</td>
                  </tr>
                ))}
                {/* Empty rows for additional items */}
                {freightItems.length < 4 && Array.from({ length: 4 - freightItems.length }).map((_, idx) => (
                  <tr key={`empty-${idx}`}>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', height: '20px' }}>&nbsp;</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>&nbsp;</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>&nbsp;</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>&nbsp;</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>&nbsp;</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>&nbsp;</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>&nbsp;</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>&nbsp;</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>&nbsp;</td>
                  </tr>
                ))}
                {/* Totals Row */}
                <tr style={{ fontWeight: 'bold' }}>
                  <td colSpan={4} style={{ border: '1px solid #000', padding: '4px 6px', fontSize: '9px', textAlign: 'right' }}>GRAND TOTAL:</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: '10px', textAlign: 'right', fontWeight: 'bold' }}>
                    {totalWeight ? totalWeight.toLocaleString() : ''}
                  </td>
                  <td colSpan={4} style={{ border: '1px solid #000', padding: '4px 6px', fontSize: '10px' }}>
                    Total Pieces: {totalPieces || ''}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Special Instructions */}
            <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '0' }}>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '6px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' as const, marginBottom: '4px' }}>Special Instructions / Handling Notes:</div>
                    <div style={{ fontSize: '10px', minHeight: '30px' }}>{bolData.special_instructions || ''}</div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Freight Charges / Payment */}
            <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '0' }}>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '6px', width: '33%' }}>
                    <div style={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' as const }}>Freight Charge Terms:</div>
                    <div style={{ fontSize: '10px', marginTop: '4px' }}>
                      <label style={{ marginRight: '12px' }}>
                        [{bolData.prepaid_or_collect === 'prepaid' ? 'X' : ' '}] Prepaid
                      </label>
                      <label style={{ marginRight: '12px' }}>
                        [{bolData.prepaid_or_collect === 'collect' ? 'X' : ' '}] Collect
                      </label>
                      <label>
                        [{bolData.prepaid_or_collect === 'third_party' ? 'X' : ' '}] 3rd Party
                      </label>
                    </div>
                  </td>
                  <td style={{ border: '1px solid #000', padding: '6px', width: '33%' }}>
                    <div style={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' as const }}>COD Amount:</div>
                    <div style={{ fontSize: '10px' }}>{bolData.cod_amount ? `$${bolData.cod_amount.toFixed(2)}` : 'N/A'}</div>
                  </td>
                  <td style={{ border: '1px solid #000', padding: '6px', width: '34%' }}>
                    <div style={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' as const }}>Declared Value:</div>
                    <div style={{ fontSize: '10px' }}>{bolData.declared_value ? `$${bolData.declared_value.toFixed(2)}` : 'N/A'}</div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Signatures */}
            <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: '0' }}>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '8px', width: '50%', verticalAlign: 'top' }}>
                    <div style={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' as const, marginBottom: '30px' }}>
                      Shipper Signature / Date
                    </div>
                    <div style={{ borderTop: '1px solid #000', paddingTop: '4px', fontSize: '8px' }}>
                      This is to certify that the above named articles are properly classified, described, packaged, marked, and labeled, and are in proper condition for transportation.
                    </div>
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', width: '50%', verticalAlign: 'top' }}>
                    <div style={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' as const, marginBottom: '30px' }}>
                      Carrier Signature / Pickup Date
                    </div>
                    <div style={{ borderTop: '1px solid #000', paddingTop: '4px', fontSize: '8px' }}>
                      Carrier acknowledges receipt of packages and required placards. Carrier certifies emergency response information was made available.
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Footer */}
            <div style={{ textAlign: 'center', fontSize: '7px', color: '#888', marginTop: '8px' }}>
              Generated on {new Date().toLocaleString()} | BOL ID: {bolId}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
