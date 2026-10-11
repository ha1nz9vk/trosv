import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getAmenities,
  getCities,
  getListings,
  getSchools,
  getWards,
} from "../api/listingApi";
import { errMessage } from "../api/axiosClient";
import type { Amenity, City, Listing, PaginationMeta, School, Ward } from "../types/api";

export interface ListingFilters {
  q: string;
  type: string;
  city_id: string;
  ward_id: string;
  school_id: string;
  max_km: string;
  price_min: string;
  price_max: string;
  amenity_ids: number[];
  sort: string;
}

const EMPTY_FILTERS: ListingFilters = {
  q: "",
  type: "",
  city_id: "",
  ward_id: "",
  school_id: "",
  max_km: "",
  price_min: "",
  price_max: "",
  amenity_ids: [],
  sort: "newest",
};

/**
 * Listing search for the /rooms page: filter state, reference data
 * (cities/wards/schools/amenities), debounced fetch with URL-sync for
 * q/type, and cascade-aware filter setters (city change resets ward/
 * school/radius). Pagination state rides along so filter changes reset
 * to page 1.
 */
export function useListingSearch() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [cities, setCities] = useState<City[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);

  const [filters, setFilters] = useState<ListingFilters>(() => ({
    ...EMPTY_FILTERS,
    q: searchParams.get("q") || "",
    type: searchParams.get("type") || "",
  }));
  const [page, setPage] = useState(1);
  const [listings, setListings] = useState<Listing[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const firstRender = useRef(true);

  useEffect(() => {
    getCities().then(setCities).catch(() => {});
    getSchools().then(setSchools).catch(() => {});
    getWards().then(setWards).catch(() => {});
    getAmenities().then(setAmenities).catch(() => {});
  }, []);

  // Build query from filters and fetch.
  const fetchListings = useCallback(
    async (currentPage: number) => {
      setLoading(true);
      setError("");
      const params: Record<string, string | number | number[]> = {
        page: currentPage,
        per_page: 12,
        sort: filters.sort,
      };
      if (filters.q.trim()) params.q = filters.q.trim();
      if (filters.type) params.type = filters.type;
      if (filters.city_id) params.city_id = filters.city_id;
      if (filters.ward_id) params.ward_id = filters.ward_id;
      if (filters.school_id) params.school_id = filters.school_id;
      if (filters.max_km) params.max_km = filters.max_km;
      if (filters.price_min) params.price_min = filters.price_min;
      if (filters.price_max) params.price_max = filters.price_max;
      if (filters.amenity_ids.length) params["amenity_ids[]"] = filters.amenity_ids;

      try {
        const { data, meta: m } = await getListings(params);
        setListings(data);
        setMeta(m);
      } catch (err) {
        setError(errMessage(err));
        setListings([]);
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  // Refetch whenever filters change (debounced) or page changes.
  useEffect(() => {
    const t = setTimeout(() => {
      void fetchListings(page);
      if (!firstRender.current) {
        const next: Record<string, string> = {};
        if (filters.q) next.q = filters.q;
        if (filters.type) next.type = filters.type;
        setSearchParams(next, { replace: true });
      }
      firstRender.current = false;
    }, 300);
    return () => { clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  const setFilter = (key: keyof ListingFilters, value: string): void => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  // Đổi Tỉnh/TP: reset ward/school để cascade hợp lệ.
  const setCity = (cityId: string): void => {
    setPage(1);
    setFilters((f) => ({
      ...f,
      city_id: cityId,
      ward_id: "",
      school_id: "",
      max_km: "",
    }));
  };

  // Đổi phường: reset school/radius - danh sách trường chỉ hiện trường
  // thuộc phường đã chọn (schools.ward_id), cascade ward -> school.
  const setWard = (wardId: string): void => {
    setPage(1);
    setFilters((f) => ({
      ...f,
      ward_id: wardId,
      school_id: "",
      max_km: "",
    }));
  };

  const toggleAmenity = (id: number): void => {
    setPage(1);
    setFilters((f) => ({
      ...f,
      amenity_ids: f.amenity_ids.includes(id)
        ? f.amenity_ids.filter((a) => a !== id)
        : [...f.amenity_ids, id],
    }));
  };

  const resetFilters = (): void => {
    setPage(1);
    setFilters({ ...EMPTY_FILTERS });
  };

  return {
    // reference data
    cities,
    wards,
    schools,
    amenities,
    // search state
    filters,
    setFilter,
    setCity,
    setWard,
    toggleAmenity,
    resetFilters,
    // results
    listings,
    setListings,
    meta,
    loading,
    error,
    page,
    setPage,
  };
}
