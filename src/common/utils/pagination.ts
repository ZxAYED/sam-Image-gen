export function getPagination(
  page: number | undefined,
  limit: number | undefined,
  totalItems: number,
) {
  const currentPage = Number(page) > 0 ? Number(page) : 1;
  const perPage = Number(limit) > 0 ? Number(limit) : 10;

  const skip = (currentPage - 1) * perPage;
  const take = perPage;

  const totalPages = Math.ceil(totalItems / perPage);

  // 👇 current page e koyta value thakar kotha
  const remainingItems = totalItems - skip;
  const pageItemCount =
    remainingItems >= perPage ? perPage : Math.max(remainingItems, 0);

  return {
    skip,
    take,
    meta: {
      currentPage,
      perPage,
      totalItems,
      totalPages,
      pageItemCount, // 👈 NEW
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    },
  };
}
