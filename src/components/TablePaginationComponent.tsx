// MUI Imports
import Pagination from '@mui/material/Pagination'
import Typography from '@mui/material/Typography'

// Third Party Imports
import type { useReactTable } from '@tanstack/react-table'

type ServerPaginationTotal = {
  /** When set, totals and page count reflect the server total (manual / server-side pagination). */
  total: number
}

const TablePaginationComponent = ({
  table,
  serverPagination
}: {
  table: ReturnType<typeof useReactTable>
  serverPagination?: ServerPaginationTotal
}) => {
  const { pageIndex, pageSize } = table.getState().pagination
  const clientRowCount = table.getFilteredRowModel().rows.length
  const totalEntries = serverPagination !== undefined ? serverPagination.total : clientRowCount
  const pageCount = Math.max(1, Math.ceil(totalEntries / pageSize))

  const showingFrom =
    totalEntries === 0 ? 0 : Math.min(pageIndex * pageSize + 1, totalEntries)
  const showingTo =
    totalEntries === 0 ? 0 : Math.min((pageIndex + 1) * pageSize, totalEntries)

  return (
    <div className='flex justify-between items-center flex-wrap pli-6 border-bs bs-auto plb-[12.5px] gap-2'>
      <Typography color='text.disabled'>
        {`Showing ${showingFrom} to ${showingTo} of ${totalEntries} entries`}
      </Typography>
      <Pagination
        shape='rounded'
        color='primary'
        variant='tonal'
        count={pageCount}
        page={pageIndex + 1}
        onChange={(_, page) => {
          table.setPageIndex(page - 1)
        }}
        showFirstButton
        showLastButton
      />
    </div>
  )
}

export default TablePaginationComponent
