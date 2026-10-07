import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const emptyForm = {
  name: "",
  city: "",
  street: "",
  area: "",
  state: "",
  postalCode: "",
  country: "India",
  description: "",
  coverImage: "",
  gallery: "",
  amenities: "",
  phone: "",
  email: "",
  latitude: "",
  longitude: "",
  isActive: true,
};

const normalizeAddress = (address, fallbackCity = "") => {
  if (!address) {
    return {
      street: "",
      area: "",
      city: fallbackCity || "",
      state: "",
      postalCode: "",
      country: "India",
    };
  }

  // Backward compatibility for old records that stored address as text.
  if (typeof address === "string") {
    return {
      street: address,
      area: "",
      city: fallbackCity || "",
      state: "",
      postalCode: "",
      country: "India",
    };
  }

  return {
    street: address.street || "",
    area: address.area || "",
    city: address.city || fallbackCity || "",
    state: address.state || "",
    postalCode: address.postalCode || "",
    country: address.country || "India",
  };
};

const formatAddress = (address, fallbackCity = "") => {
  const normalized = normalizeAddress(address, fallbackCity);

  return [
    normalized.street,
    normalized.area,
    normalized.city,
    normalized.state,
    normalized.postalCode,
    normalized.country,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(", ");
};

const Field = ({ label, ...props }) => (
  <div>
    <label className="mb-2 block text-sm text-zinc-400">{label}</label>

    <input
      {...props}
      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-red-500"
    />
  </div>
);

const AdminTheatres = () => {
  const { token } = useAuth();

  const [theatres, setTheatres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTheatre, setEditingTheatre] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchTheatres = async () => {
    if (!token) return;

    setLoading(true);

    try {
      const response = await axios.get(`${API_URL}/api/admin/theatres`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setTheatres(response.data.theatres || []);
    } catch (error) {
      console.error("Theatres error:", error);

      toast.error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Could not load theatres."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  fetchTheatres();
}, [token]);

  const filteredTheatres = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return theatres;
    }

    return theatres.filter((theatre) => {
      const searchable = [
        theatre.name,
        theatre.city,
        formatAddress(theatre.address, theatre.city),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [theatres, search]);

  const openAdd = () => {
    setEditingTheatre(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (theatre) => {
    const coordinates = theatre.location?.coordinates || [];
    const address = normalizeAddress(theatre.address, theatre.city);

    setEditingTheatre(theatre);

    setForm({
      name: theatre.name || "",
      city: theatre.city || address.city || "",
      street: address.street,
      area: address.area,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country || "India",
      description: theatre.description || "",
      coverImage: theatre.coverImage || "",
      gallery: Array.isArray(theatre.gallery)
        ? theatre.gallery.join("\n")
        : "",
      amenities: Array.isArray(theatre.amenities)
        ? theatre.amenities.join(", ")
        : "",
      phone: theatre.contact?.phone || "",
      email: theatre.contact?.email || "",
      longitude: coordinates[0] ?? "",
      latitude: coordinates[1] ?? "",
      isActive: theatre.isActive !== false,
    });

    setModalOpen(true);
  };

  const handleChange = (event) => {
    const { name, value, checked, type } = event.target;

    setForm((current) => ({
      ...current,

      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  };

  const buildPayload = () => {
    const gallery = form.gallery
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

    const amenities = form.amenities
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const payload = {
      name: form.name.trim(),

      city: form.city.trim(),

      address: {
        street: form.street.trim(),
        area: form.area.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postalCode: form.postalCode.trim(),
        country: form.country.trim() || "India",
      },

      description: form.description.trim(),

      coverImage: form.coverImage.trim(),

      gallery,

      amenities,

      contact: {
        phone: form.phone.trim(),
        email: form.email.trim(),
      },

      isActive: form.isActive,
    };

    if (
      form.latitude !== "" &&
      form.longitude !== ""
    ) {
      payload.location = {
        type: "Point",

        // GeoJSON order is [longitude, latitude].
        coordinates: [
          Number(form.longitude),
          Number(form.latitude),
        ],
      };
    }

    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (
      !form.name.trim() ||
      !form.city.trim() ||
      !form.street.trim()
    ) {
      toast.error(
        "Theatre name, city and street address are required."
      );

      return;
    }

    setSaving(true);

    try {
      const payload = buildPayload();

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      if (editingTheatre) {
        await axios.put(
          `${API_URL}/api/theatres/${editingTheatre._id}`,
          payload,
          config
        );

        toast.success("Theatre updated.");
      } else {
        await axios.post(
          `${API_URL}/api/theatres`,
          payload,
          config
        );

        toast.success("Theatre added.");
      }

      setModalOpen(false);

      setEditingTheatre(null);

      setForm({
        ...emptyForm,
      });

      await fetchTheatres();
    } catch (error) {
      console.error(
        "Save theatre error:",
        error
      );

      toast.error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Could not save theatre."
      );
    } finally {
      setSaving(false);
    }
  };

  const deactivateTheatre = async (theatre) => {
    if (
      !window.confirm(
        `Deactivate "${theatre.name}"?`
      )
    ) {
      return;
    }

    try {
      await axios.delete(
        `${API_URL}/api/theatres/${theatre._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      toast.success(
        "Theatre deactivated."
      );

      await fetchTheatres();
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Could not deactivate theatre."
      );
    }
  };

  const reactivateTheatre = async (theatre) => {
    try {
      await axios.put(
        `${API_URL}/api/theatres/${theatre._id}`,

        {
          isActive: true,
        },

        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      toast.success(
        "Theatre reactivated."
      );

      await fetchTheatres();
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Could not reactivate theatre."
      );
    }
  };

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-red-500">
            Cinema Network
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Theatres
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Manage cinema locations, photos and amenities.
          </p>
        </div>

        <motion.button
          whileHover={{
            scale: 1.02,
          }}
          whileTap={{
            scale: 0.97,
          }}
          onClick={openAdd}
          className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-semibold transition hover:bg-red-500"
        >
          <Plus className="h-5 w-5" />

          Add Theatre
        </motion.button>
      </div>

      <div className="relative mt-8 max-w-md">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />

        <input
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Search theatres..."
          className="w-full rounded-xl border border-white/10 bg-zinc-900 py-3 pl-11 pr-4 text-sm outline-none focus:border-red-500"
        />
      </div>

      {loading ? (
        <div className="py-24 text-center text-zinc-500">
          Loading theatres...
        </div>
      ) : filteredTheatres.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-white/10 py-24 text-center">
          <Building2 className="mx-auto h-10 w-10 text-zinc-700" />

          <p className="mt-4 text-zinc-500">
            No theatres found.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {filteredTheatres.map(
            (
              theatre,
              index
            ) => (
              <motion.div
                key={theatre._id}
                initial={{
                  opacity: 0,
                  y: 20,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: Math.min(
                    index * 0.04,
                    0.3
                  ),
                }}
                whileHover={{
                  y: -3,
                }}
                className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50 transition hover:border-red-500/25"
              >
                <div className="relative h-56 bg-zinc-900">
                  {theatre.coverImage ? (
                    <img
                      src={
                        theatre.coverImage
                      }
                      alt={
                        theatre.name
                      }
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Building2 className="h-14 w-14 text-zinc-700" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-[#111113] via-transparent to-transparent" />

                  <div
                    className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-medium ${
                      theatre.isActive !== false
                        ? "bg-green-500/15 text-green-400"
                        : "bg-zinc-900/90 text-zinc-500"
                    }`}
                  >
                    {theatre.isActive !==
                    false
                      ? "Active"
                      : "Inactive"}
                  </div>
                </div>

                <div className="p-6">
                  <h2 className="text-xl font-bold">
                    {
                      theatre.name
                    }
                  </h2>

                  <div className="mt-3 flex items-start gap-2 text-sm text-zinc-500">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />

                    <span>
                      {formatAddress(
                        theatre.address,
                        theatre.city
                      ) ||
                        theatre.city}
                    </span>
                  </div>

                  {theatre.description && (
                    <p className="mt-4 line-clamp-2 text-sm leading-6 text-zinc-500">
                      {
                        theatre.description
                      }
                    </p>
                  )}

                  {Array.isArray(
                    theatre.amenities
                  ) &&
                    theatre.amenities
                      .length >
                      0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {theatre.amenities
                          .slice(
                            0,
                            5
                          )
                          .map(
                            (
                              amenity
                            ) => (
                              <span
                                key={
                                  amenity
                                }
                                className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-500"
                              >
                                {
                                  amenity
                                }
                              </span>
                            )
                          )}
                      </div>
                    )}

                  <div className="mt-5 space-y-2">
                    {theatre.contact
                      ?.phone && (
                      <div className="flex items-center gap-2 text-xs text-zinc-600">
                        <Phone className="h-3.5 w-3.5" />

                        {
                          theatre
                            .contact
                            .phone
                        }
                      </div>
                    )}

                    {theatre.contact
                      ?.email && (
                      <div className="flex items-center gap-2 text-xs text-zinc-600">
                        <Mail className="h-3.5 w-3.5" />

                        {
                          theatre
                            .contact
                            .email
                        }
                      </div>
                    )}
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <button
                      onClick={() =>
                        openEdit(
                          theatre
                        )
                      }
                      className="flex items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm font-medium transition hover:border-red-500/30 hover:bg-white/5"
                    >
                      <Pencil className="h-4 w-4" />

                      Edit
                    </button>

                    {theatre.isActive !==
                    false ? (
                      <button
                        onClick={() =>
                          deactivateTheatre(
                            theatre
                          )
                        }
                        className="flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 py-3 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />

                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          reactivateTheatre(
                            theatre
                          )
                        }
                        className="rounded-xl border border-green-500/20 bg-green-500/5 py-3 text-sm font-medium text-green-400 transition hover:bg-green-500/10"
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          )}
        </div>
      )}

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.96,
                y: 20,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.96,
              }}
              className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#111113]"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#111113]/95 px-6 py-5 backdrop-blur-xl">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-red-500">
                    Theatre Management
                  </p>

                  <h2 className="mt-1 text-xl font-bold">
                    {editingTheatre
                      ? "Edit Theatre"
                      : "Add Theatre"}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setModalOpen(
                      false
                    )
                  }
                  className="rounded-xl border border-white/10 p-2 text-zinc-500 hover:bg-white/5 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                onSubmit={
                  handleSubmit
                }
                className="space-y-6 p-6"
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    label="Theatre Name"
                    name="name"
                    value={form.name}
                    onChange={
                      handleChange
                    }
                    placeholder="BookMySeat Cinemas"
                    required
                  />

                  <Field
                    label="City"
                    name="city"
                    value={form.city}
                    onChange={
                      handleChange
                    }
                    placeholder="Mumbai"
                    required
                  />
                </div>

                <div>
                  <p className="mb-4 text-sm font-semibold">
                    Address
                  </p>

                  <div className="grid gap-5 md:grid-cols-2">
                    <Field
                      label="Street / Road"
                      name="street"
                      value={
                        form.street
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Link Road"
                      required
                    />

                    <Field
                      label="Area"
                      name="area"
                      value={
                        form.area
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Andheri West"
                    />

                    <Field
                      label="State"
                      name="state"
                      value={
                        form.state
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Maharashtra"
                    />

                    <Field
                      label="Postal Code"
                      name="postalCode"
                      value={
                        form.postalCode
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="400053"
                    />

                    <Field
                      label="Country"
                      name="country"
                      value={
                        form.country
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="India"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Description
                  </label>

                  <textarea
                    name="description"
                    value={
                      form.description
                    }
                    onChange={
                      handleChange
                    }
                    rows={4}
                    placeholder="Tell customers about this cinema..."
                    className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-red-500"
                  />
                </div>

                <Field
                  label="Cover Image URL"
                  name="coverImage"
                  value={
                    form.coverImage
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="https://..."
                />

                {form.coverImage && (
                  <div className="overflow-hidden rounded-2xl border border-white/10">
                    <img
                      src={
                        form.coverImage
                      }
                      alt="Theatre preview"
                      className="h-52 w-full object-cover"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Gallery Image URLs
                  </label>

                  <textarea
                    name="gallery"
                    value={
                      form.gallery
                    }
                    onChange={
                      handleChange
                    }
                    rows={4}
                    placeholder={`https://image1.jpg
https://image2.jpg
https://image3.jpg`}
                    className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-red-500"
                  />

                  <p className="mt-2 text-xs text-zinc-600">
                    Put one image URL per line.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Amenities
                  </label>

                  <input
                    name="amenities"
                    value={
                      form.amenities
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Dolby Atmos, Parking, Food Court, Recliners"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-red-500"
                  />

                  <p className="mt-2 text-xs text-zinc-600">
                    Separate amenities using commas.
                  </p>
                </div>

                <div>
                  <p className="mb-4 text-sm font-semibold">
                    Contact Details
                  </p>

                  <div className="grid gap-5 md:grid-cols-2">
                    <Field
                      label="Phone"
                      name="phone"
                      value={
                        form.phone
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="+91 98765 43210"
                    />

                    <Field
                      label="Email"
                      name="email"
                      type="email"
                      value={
                        form.email
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="cinema@example.com"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-4">
                    <p className="text-sm font-semibold">
                      Map Location
                    </p>

                    <p className="mt-1 text-xs text-zinc-600">
                      Optional coordinates for location-based theatre search.
                    </p>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <Field
                      label="Latitude"
                      name="latitude"
                      type="number"
                      step="any"
                      value={
                        form.latitude
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="19.0760"
                    />

                    <Field
                      label="Longitude"
                      name="longitude"
                      type="number"
                      step="any"
                      value={
                        form.longitude
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="72.8777"
                    />
                  </div>
                </div>

                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-black/20 p-4">
                  <div>
                    <p className="font-medium">
                      Theatre Active
                    </p>

                    <p className="mt-1 text-xs text-zinc-600">
                      Active theatres can host shows and appear to customers.
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    name="isActive"
                    checked={
                      form.isActive
                    }
                    onChange={
                      handleChange
                    }
                    className="h-5 w-5 accent-red-600"
                  />
                </label>

                <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
                  <button
                    type="button"
                    onClick={() =>
                      setModalOpen(
                        false
                      )
                    }
                    className="rounded-xl border border-white/10 px-6 py-3 text-sm text-zinc-400 hover:bg-white/5"
                  >
                    Cancel
                  </button>

                  <motion.button
                    whileTap={{
                      scale: 0.97,
                    }}
                    disabled={
                      saving
                    }
                    type="submit"
                    className="flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold hover:bg-red-500 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />

                    {saving
                      ? "Saving..."
                      : editingTheatre
                      ? "Save Changes"
                      : "Add Theatre"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminTheatres;