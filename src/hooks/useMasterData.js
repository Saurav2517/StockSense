import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as productService from '../services/product.service';
import * as warehouseService from '../services/warehouse.service';
import * as contactService from '../services/contact.service';
import * as authService from '../services/auth.service';

export const keys = {
  categories: ['categories'],
  products: (f) => ['products', f ?? {}],
  productList: ['product-list'],
  warehouses: ['warehouses'],
  locations: (f) => ['locations', f ?? {}],
  contacts: (entity) => ['contacts', entity],
  profiles: ['profiles'],
};

// ---------------- reads ----------------
export const useCategories = () => useQuery({ queryKey: keys.categories, queryFn: productService.listCategories });

export const useProductStock = (filters) =>
  useQuery({ queryKey: keys.products(filters), queryFn: () => productService.listProductStock(filters), placeholderData: (prev) => prev });

export const useProductList = () => useQuery({ queryKey: keys.productList, queryFn: () => productService.listProducts({ activeOnly: true }) });

export const useWarehouses = (opts) =>
  useQuery({ queryKey: [...keys.warehouses, opts ?? {}], queryFn: () => warehouseService.listWarehouses(opts) });

export const useLocations = (filters) =>
  useQuery({ queryKey: keys.locations(filters), queryFn: () => warehouseService.listLocations(filters) });

export const useContacts = (entity) =>
  useQuery({ queryKey: keys.contacts(entity), queryFn: () => contactService.listContacts(entity), enabled: Boolean(entity) });

export const useProfiles = () => useQuery({ queryKey: keys.profiles, queryFn: authService.listProfiles });

// ---------------- writes ----------------
function useInvalidating(mutationFn, keysToInvalidate) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => keysToInvalidate.forEach((k) => qc.invalidateQueries({ queryKey: k })),
  });
}

export const useSaveCategory = () =>
  useInvalidating(({ id, values }) => (id ? productService.updateCategory(id, values) : productService.createCategory(values)), [keys.categories, ['products']]);
export const useDeleteCategory = () => useInvalidating((id) => productService.deleteCategory(id), [keys.categories, ['products']]);

export const useSaveProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values, initialStock }) => {
      const product = id ? await productService.updateProduct(id, values) : await productService.createProduct(values);
      if (!id && initialStock && Number(initialStock.quantity) > 0) {
        await productService.initProductStock({
          productId: product.id,
          locationId: initialStock.locationId,
          quantity: Number(initialStock.quantity),
        });
      }
      return product;
    },
    onSuccess: () => qc.invalidateQueries(),
  });
};

export const useSaveWarehouse = () =>
  useInvalidating(({ id, values }) => (id ? warehouseService.updateWarehouse(id, values) : warehouseService.createWarehouse(values)), [keys.warehouses, ['locations']]);

export const useSaveLocation = () =>
  useInvalidating(({ id, values }) => (id ? warehouseService.updateLocation(id, values) : warehouseService.createLocation(values)), [['locations']]);

export const useSaveContact = (entity) =>
  useInvalidating(({ id, values }) => (id ? contactService.updateContact(entity, id, values) : contactService.createContact(entity, values)), [keys.contacts(entity)]);
export const useDeleteContact = (entity) => useInvalidating((id) => contactService.deleteContact(entity, id), [keys.contacts(entity)]);
