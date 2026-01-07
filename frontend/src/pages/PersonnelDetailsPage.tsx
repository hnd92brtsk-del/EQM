import { useEffect, useMemo, useState } from "react";
import {
  Box,Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  TextField,
  Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { DataTable } from "../components/DataTable";
import { ErrorSnackbar } from "../components/ErrorSnackbar";
import {
  Personnel,
  PersonnelCompetency,
  PersonnelTraining,
  createCompetency,
  createTraining,
  deleteCompetency,
  deleteTraining,
  downloadAttachment,
  getPersonnel,
  listAttachments,
  restoreCompetency,
  restoreTraining,
  updateCompetency,
  updatePersonnel,
  updateTraining,
  uploadAttachment,
  uploadPersonnelPhoto
} from "../api/personnel";
import { useAuth } from "../context/AuthContext";
import { AppButton } from "../components/ui/AppButton";

type DialogState = {
  open: boolean;
  title: string;
  values: Record<string, any>;
  onSave: (values: Record<string, any>, file?: File | null) => void;
};

function daysToAge(days?: number | null) {
  if (days === null || days === undefined) {
    return "-";
  }
  const years = Math.floor(days / 365);
  const remainder = days % 365;
  return years ? `${years}y ${remainder}d` : `${remainder}d`;
}

export default function PersonnelDetailsPage() {
  const { id } = useParams();
  const personId = Number(id);
  const { user } = useAuth();
  const { t } = useTranslation();
  const canWrite = user?.role === "admin";
  const queryClient = useQueryClient();

  const [tab, setTab] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profileState, setProfileState] = useState<Partial<Personnel>>({});
  const [competencyDialog, setCompetencyDialog] = useState<DialogState | null>(null);
  const [trainingDialog, setTrainingDialog] = useState<DialogState | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [attachmentDialog, setAttachmentDialog] = useState<{
    title: string;
    entity: string;
    entityId: number;
  } | null>(null);

  const personnelQuery = useQuery({
    queryKey: ["personnel", personId],
    queryFn: () => getPersonnel(personId)
  });

  const attachmentsQuery = useQuery({
    queryKey: ["personnel-attachments", personId],
    queryFn: () => listAttachments(personId, "personnel")
  });

  const attachmentListQuery = useQuery({
    queryKey: [
      "personnel-attachments",
      personId,
      attachmentDialog?.entity,
      attachmentDialog?.entityId
    ],
    queryFn: () =>
      listAttachments(personId, attachmentDialog!.entity, attachmentDialog!.entityId),
    enabled: Boolean(attachmentDialog)
  });

  useEffect(() => {
    if (personnelQuery.data) {
      setProfileState(personnelQuery.data);
    }
  }, [personnelQuery.data]);

  useEffect(() => {
    if (attachmentsQuery.data) {
      const image = attachmentsQuery.data.find((attachment) =>
        attachment.content_type.startsWith("image/")
      );
      if (!image) {
        setPhotoUrl(null);
        return;
      }
      downloadAttachment(image.id)
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          setPhotoUrl(url);
        })
        .catch((error) =>
          setErrorMessage(error instanceof Error ? error.message : t("errors.attachment_download_failed"))
        );
    }
  }, [attachmentsQuery.data, t]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["personnel", personId] });
    queryClient.invalidateQueries({ queryKey: ["personnel-attachments", personId] });
  };

  const updatePersonnelMutation = useMutation({
    mutationFn: (payload: Partial<Personnel>) => updatePersonnel(personId, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("errors.update_personnel_failed"))
  });

  const createCompetencyMutation = useMutation({
    mutationFn: (payload: Partial<PersonnelCompetency>) => createCompetency(personId, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("errors.create_competency_failed"))
  });

  const updateCompetencyMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<PersonnelCompetency> }) =>
      updateCompetency(personId, id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("errors.update_competency_failed"))
  });

  const deleteCompetencyMutation = useMutation({
    mutationFn: (id: number) => deleteCompetency(personId, id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("errors.delete_competency_failed"))
  });

  const restoreCompetencyMutation = useMutation({
    mutationFn: (id: number) => restoreCompetency(personId, id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("errors.restore_competency_failed"))
  });

  const createTrainingMutation = useMutation({
    mutationFn: (payload: Partial<PersonnelTraining>) => createTraining(personId, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("errors.create_training_failed"))
  });

  const updateTrainingMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<PersonnelTraining> }) =>
      updateTraining(personId, id, payload),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("errors.update_training_failed"))
  });

  const deleteTrainingMutation = useMutation({
    mutationFn: (id: number) => deleteTraining(personId, id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("errors.delete_training_failed"))
  });

  const restoreTrainingMutation = useMutation({
    mutationFn: (id: number) => restoreTraining(personId, id),
    onSuccess: refresh,
    onError: (error) =>
      setErrorMessage(error instanceof Error ? error.message : t("errors.restore_training_failed"))
  });

  const competencyColumns = useMemo<ColumnDef<PersonnelCompetency>[]>(() => {
    const base: ColumnDef<PersonnelCompetency>[] = [
      { header: "Name", accessorKey: "name" },
      { header: "Organisation", accessorKey: "organisation" },
      { header: "City", accessorKey: "city" },
      { header: "Completion date", accessorKey: "completion_date" },
      {
        header: "Age",
        cell: ({ row }) => daysToAge(row.original.completion_age_days)
      }
    ];

    if (canWrite) {
      base.push({
        header: "Actions",
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <AppButton
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() =>
                setCompetencyDialog({
                  open: true,
                  title: "Edit competency",
                  values: row.original,
                  onSave: (values, file) => {
                    updateCompetencyMutation.mutate({
                      id: row.original.id,
                      payload: {
                        name: values.name,
                        organisation: values.organisation || null,
                        city: values.city || null,
                        completion_date: values.completion_date || null
                      }
                    });
                    if (file) {
                      uploadAttachment(personId, "personnel_competency", row.original.id, file).catch((error) =>
                        setErrorMessage(
                          error instanceof Error ? error.message : t("errors.attachment_upload_failed")
                        )
                      );
                      queryClient.invalidateQueries({
                        queryKey: ["personnel-attachments", personId, "personnel_competency", row.original.id]
                      });
                    }
                    setCompetencyDialog(null);
                  }
                })
              }
            >
              Edit
            </AppButton>
            <AppButton
              size="small"
              color={row.original.is_deleted ? "success" : "error"}
              startIcon={row.original.is_deleted ? <RestoreRoundedIcon /> : <DeleteOutlineRoundedIcon />}
              onClick={() =>
                row.original.is_deleted
                  ? restoreCompetencyMutation.mutate(row.original.id)
                  : deleteCompetencyMutation.mutate(row.original.id)
              }
            >
              {row.original.is_deleted ? "Restore" : "Delete"}
            </AppButton>
            <AppButton
              size="small"
              onClick={() =>
                setAttachmentDialog({
                  title: "Competency attachments",
                  entity: "personnel_competency",
                  entityId: row.original.id
                })
              }
            >
              Attachment
            </AppButton>
          </Box>
        )
      });
    }

    return base;
  }, [
    canWrite,
    deleteCompetencyMutation,
    personId,
    queryClient,
    restoreCompetencyMutation,
    setAttachmentDialog,
    t,
    updateCompetencyMutation
  ]);

  const trainingColumns = useMemo<ColumnDef<PersonnelTraining>[]>(() => {
    const base: ColumnDef<PersonnelTraining>[] = [
      { header: "Name", accessorKey: "name" },
      { header: "Completion date", accessorKey: "completion_date" },
      { header: "Next due date", accessorKey: "next_due_date" },
      {
        header: "Days until due",
        cell: ({ row }) => {
          const value = row.original.days_until_due;
          const warning =
            value !== null &&
            value !== undefined &&
            value <= (row.original.reminder_offset_days ?? 0) &&
            value > 0;
          const expired = value !== null && value !== undefined && value <= 0;
          const color = expired ? "#ef5350" : warning ? "#f9a825" : undefined;
          return <span style={{ color }}>{value ?? "-"}</span>;
        }
      },
      { header: "Reminder offset", accessorKey: "reminder_offset_days" }
    ];

    if (canWrite) {
      base.push({
        header: "Actions",
        cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <AppButton
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() =>
                setTrainingDialog({
                  open: true,
                  title: "Edit training",
                  values: row.original,
                  onSave: (values, file) => {
                    updateTrainingMutation.mutate({
                      id: row.original.id,
                      payload: {
                        name: values.name,
                        completion_date: values.completion_date || null,
                        next_due_date: values.next_due_date || null,
                        reminder_offset_days: Number(values.reminder_offset_days || 0)
                      }
                    });
                    if (file) {
                      uploadAttachment(personId, "personnel_training", row.original.id, file).catch((error) =>
                        setErrorMessage(
                          error instanceof Error ? error.message : t("errors.attachment_upload_failed")
                        )
                      );
                      queryClient.invalidateQueries({
                        queryKey: ["personnel-attachments", personId, "personnel_training", row.original.id]
                      });
                    }
                    setTrainingDialog(null);
                  }
                })
              }
            >
              Edit
            </AppButton>
            <AppButton
              size="small"
              color={row.original.is_deleted ? "success" : "error"}
              startIcon={row.original.is_deleted ? <RestoreRoundedIcon /> : <DeleteOutlineRoundedIcon />}
              onClick={() =>
                row.original.is_deleted
                  ? restoreTrainingMutation.mutate(row.original.id)
                  : deleteTrainingMutation.mutate(row.original.id)
              }
            >
              {row.original.is_deleted ? "Restore" : "Delete"}
            </AppButton>
            <AppButton
              size="small"
              onClick={() =>
                setAttachmentDialog({
                  title: "Training attachments",
                  entity: "personnel_training",
                  entityId: row.original.id
                })
              }
            >
              Attachment
            </AppButton>
          </Box>
        )
      });
    }

    return base;
  }, [
    canWrite,
    deleteTrainingMutation,
    personId,
    queryClient,
    restoreTrainingMutation,
    setAttachmentDialog,
    t,
    updateTrainingMutation
  ]);

  const profileFields = [
    { label: "First name", key: "first_name" },
    { label: "Last name", key: "last_name" },
    { label: "Middle name", key: "middle_name" },
    { label: "Position", key: "position" },
    { label: "Personnel #", key: "personnel_number" },
    { label: "Service", key: "service" },
    { label: "Shop", key: "shop" },
    { label: "Department", key: "department" },
    { label: "Division", key: "division" },
    { label: "Organisation", key: "organisation" },
    { label: "Email", key: "email" },
    { label: "Phone", key: "phone" }
  ];

  const buildProfilePayload = () => ({
    first_name: profileState.first_name,
    last_name: profileState.last_name,
    middle_name: profileState.middle_name || null,
    position: profileState.position,
    personnel_number: profileState.personnel_number || null,
    service: profileState.service || null,
    shop: profileState.shop || null,
    department: profileState.department || null,
    division: profileState.division || null,
    birth_date: profileState.birth_date || null,
    hire_date: profileState.hire_date || null,
    organisation: profileState.organisation || null,
    email: profileState.email || null,
    phone: profileState.phone || null,
    notes: profileState.notes || null
  });

  if (personnelQuery.isLoading) {
    return <Typography>Loading...</Typography>;
  }

  if (!personnelQuery.data) {
    return <Typography>Personnel not found.</Typography>;
  }

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h4">
        {[personnelQuery.data.last_name, personnelQuery.data.first_name, personnelQuery.data.middle_name]
          .filter(Boolean)
          .join(" ")}
      </Typography>

      <Tabs value={tab} onChange={(_, value) => setTab(value)}>
        <Tab label="Profile" />
        <Tab label="Competencies" />
        <Tab label="Training" />
        <Tab label="Notes" />
      </Tabs>

      {tab === 0 && (
        <Card>
          <CardContent sx={{ display: "grid", gap: 2 }}>
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "160px 1fr" }}>
              <Box sx={{ display: "grid", gap: 1, justifyItems: "center" }}>
                <Box
                  sx={{
                    width: 140,
                    height: 140,
                    borderRadius: "50%",
                    backgroundColor: "rgba(0,0,0,0.08)",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden"
                  }}
                >
                  {photoUrl ? (
                    <img src={photoUrl} alt="Personnel" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <Typography variant="caption">No photo</Typography>
                  )}
                </Box>
                {canWrite && (
                  <AppButton
                    variant="outlined"
                    component="label"
                  >
                    Upload photo
                    <input
                      hidden
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) {
                          return;
                        }
                        uploadPersonnelPhoto(personId, file)
                          .then(() => refresh())
                          .catch((error) =>
                            setErrorMessage(error instanceof Error ? error.message : t("errors.photo_upload_failed"))
                          );
                      }}
                    />
                  </AppButton>
                )}
              </Box>
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                {profileFields.map((field) => (
                  <TextField
                    key={field.key}
                    label={field.label}
                    value={(profileState as any)[field.key] ?? ""}
                    onChange={(event) =>
                      setProfileState((prev) => ({ ...prev, [field.key]: event.target.value }))
                    }
                    disabled={!canWrite}
                    fullWidth
                  />
                ))}
                <TextField
                  label="Birth date"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={profileState.birth_date ?? ""}
                  onChange={(event) => setProfileState((prev) => ({ ...prev, birth_date: event.target.value }))}
                  disabled={!canWrite}
                />
                <TextField
                  label="Hire date"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={profileState.hire_date ?? ""}
                  onChange={(event) => setProfileState((prev) => ({ ...prev, hire_date: event.target.value }))}
                  disabled={!canWrite}
                />
                <TextField
                  label="Tenure (years)"
                  value={personnelQuery.data.tenure_years ?? "-"}
                  disabled
                />
                <TextField
                  label="Login"
                  value={personnelQuery.data.user?.username || "-"}
                  disabled
                />
              </Box>
            </Box>
            {canWrite && (
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <AppButton
                  variant="contained"
                  onClick={() => updatePersonnelMutation.mutate(buildProfilePayload())}
                >
                  Save profile
                </AppButton>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 1 && (
        <Card>
          <CardContent sx={{ display: "grid", gap: 2 }}>
            {canWrite && (
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <AppButton
                  variant="contained"
                  startIcon={<AddRoundedIcon />}
                  onClick={() =>
                    setCompetencyDialog({
                      open: true,
                      title: "Add competency",
                      values: { name: "", organisation: "", city: "", completion_date: "" },
                      onSave: (values, file) => {
                        createCompetencyMutation.mutate(
                          {
                            name: values.name,
                            organisation: values.organisation || null,
                            city: values.city || null,
                            completion_date: values.completion_date || null
                          },
                          {
                            onSuccess: (data) => {
                              if (file) {
                                uploadAttachment(personId, "personnel_competency", data.id, file).catch((error) =>
                                  setErrorMessage(
                                    error instanceof Error ? error.message : t("errors.attachment_upload_failed")
                                  )
                                );
                                queryClient.invalidateQueries({
                                  queryKey: ["personnel-attachments", personId, "personnel_competency", data.id]
                                });
                              }
                            }
                          }
                        );
                        setCompetencyDialog(null);
                      }
                    })
                  }
                >
                  Add competency
                </AppButton>
              </Box>
            )}
            <DataTable data={personnelQuery.data.competencies || []} columns={competencyColumns} />
          </CardContent>
        </Card>
      )}

      {tab === 2 && (
        <Card>
          <CardContent sx={{ display: "grid", gap: 2 }}>
            {canWrite && (
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <AppButton
                  variant="contained"
                  startIcon={<AddRoundedIcon />}
                  onClick={() =>
                    setTrainingDialog({
                      open: true,
                      title: "Add training",
                      values: { name: "", completion_date: "", next_due_date: "", reminder_offset_days: 0 },
                      onSave: (values, file) => {
                        createTrainingMutation.mutate(
                          {
                            name: values.name,
                            completion_date: values.completion_date || null,
                            next_due_date: values.next_due_date || null,
                            reminder_offset_days: Number(values.reminder_offset_days || 0)
                          },
                          {
                            onSuccess: (data) => {
                              if (file) {
                                uploadAttachment(personId, "personnel_training", data.id, file).catch((error) =>
                                  setErrorMessage(
                                    error instanceof Error ? error.message : t("errors.attachment_upload_failed")
                                  )
                                );
                                queryClient.invalidateQueries({
                                  queryKey: ["personnel-attachments", personId, "personnel_training", data.id]
                                });
                              }
                            }
                          }
                        );
                        setTrainingDialog(null);
                      }
                    })
                  }
                >
                  Add training
                </AppButton>
              </Box>
            )}
            <DataTable data={personnelQuery.data.trainings || []} columns={trainingColumns} />
          </CardContent>
        </Card>
      )}

      {tab === 3 && (
        <Card>
          <CardContent sx={{ display: "grid", gap: 2 }}>
            <TextField
              label="Notes"
              value={profileState.notes ?? ""}
              onChange={(event) => setProfileState((prev) => ({ ...prev, notes: event.target.value }))}
              multiline
              minRows={5}
              disabled={!canWrite}
              fullWidth
            />
            {canWrite && (
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <AppButton variant="contained" onClick={() => updatePersonnelMutation.mutate({ notes: profileState.notes })}>
                  Save notes
                </AppButton>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {competencyDialog && (
        <Dialog open onClose={() => setCompetencyDialog(null)} fullWidth maxWidth="sm">
          <DialogTitle>{competencyDialog.title}</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              value={competencyDialog.values.name}
              onChange={(event) =>
                setCompetencyDialog((prev) =>
                  prev ? { ...prev, values: { ...prev.values, name: event.target.value } } : prev
                )
              }
            />
            <TextField
              label="Organisation"
              value={competencyDialog.values.organisation}
              onChange={(event) =>
                setCompetencyDialog((prev) =>
                  prev ? { ...prev, values: { ...prev.values, organisation: event.target.value } } : prev
                )
              }
            />
            <TextField
              label="City"
              value={competencyDialog.values.city}
              onChange={(event) =>
                setCompetencyDialog((prev) =>
                  prev ? { ...prev, values: { ...prev.values, city: event.target.value } } : prev
                )
              }
            />
            <TextField
              label="Completion date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={competencyDialog.values.completion_date || ""}
              onChange={(event) =>
                setCompetencyDialog((prev) =>
                  prev ? { ...prev, values: { ...prev.values, completion_date: event.target.value } } : prev
                )
              }
            />
            <AppButton component="label" variant="outlined">
              Upload attachment
              <input
                hidden
                type="file"
                onChange={(event) =>
                  setCompetencyDialog((prev) =>
                    prev ? { ...prev, values: { ...prev.values, file: event.target.files?.[0] || null } } : prev
                  )
                }
              />
            </AppButton>
          </DialogContent>
          <DialogActions>
            <AppButton onClick={() => setCompetencyDialog(null)}>Cancel</AppButton>
            <AppButton
              variant="contained"
              onClick={() => competencyDialog.onSave(competencyDialog.values, competencyDialog.values.file)}
            >
              Save
            </AppButton>
          </DialogActions>
        </Dialog>
      )}

      {trainingDialog && (
        <Dialog open onClose={() => setTrainingDialog(null)} fullWidth maxWidth="sm">
          <DialogTitle>{trainingDialog.title}</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              value={trainingDialog.values.name}
              onChange={(event) =>
                setTrainingDialog((prev) =>
                  prev ? { ...prev, values: { ...prev.values, name: event.target.value } } : prev
                )
              }
            />
            <TextField
              label="Completion date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={trainingDialog.values.completion_date || ""}
              onChange={(event) =>
                setTrainingDialog((prev) =>
                  prev ? { ...prev, values: { ...prev.values, completion_date: event.target.value } } : prev
                )
              }
            />
            <TextField
              label="Next due date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={trainingDialog.values.next_due_date || ""}
              onChange={(event) =>
                setTrainingDialog((prev) =>
                  prev ? { ...prev, values: { ...prev.values, next_due_date: event.target.value } } : prev
                )
              }
            />
            <TextField
              label="Reminder offset (days)"
              type="number"
              value={trainingDialog.values.reminder_offset_days}
              onChange={(event) =>
                setTrainingDialog((prev) =>
                  prev
                    ? { ...prev, values: { ...prev.values, reminder_offset_days: event.target.value } }
                    : prev
                )
              }
            />
            <AppButton component="label" variant="outlined">
              Upload attachment
              <input
                hidden
                type="file"
                onChange={(event) =>
                  setTrainingDialog((prev) =>
                    prev ? { ...prev, values: { ...prev.values, file: event.target.files?.[0] || null } } : prev
                  )
                }
              />
            </AppButton>
          </DialogContent>
          <DialogActions>
            <AppButton onClick={() => setTrainingDialog(null)}>Cancel</AppButton>
            <AppButton
              variant="contained"
              onClick={() => trainingDialog.onSave(trainingDialog.values, trainingDialog.values.file)}
            >
              Save
            </AppButton>
          </DialogActions>
        </Dialog>
      )}

      {attachmentDialog && (
        <Dialog open onClose={() => setAttachmentDialog(null)} fullWidth maxWidth="sm">
          <DialogTitle>{attachmentDialog.title}</DialogTitle>
          <DialogContent sx={{ display: "grid", gap: 1, mt: 1 }}>
            {attachmentListQuery.isLoading && <Typography>Loading...</Typography>}
            {attachmentListQuery.data?.length ? (
              attachmentListQuery.data.map((attachment) => (
                <Box key={attachment.id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography sx={{ flexGrow: 1 }}>{attachment.filename}</Typography>
                  <AppButton
                    size="small"
                    onClick={async () => {
                      try {
                        const blob = await downloadAttachment(attachment.id);
                        const url = URL.createObjectURL(blob);
                        window.open(url, "_blank");
                      } catch (error) {
                        setErrorMessage(
                          error instanceof Error ? error.message : t("errors.attachment_download_failed")
                        );
                      }
                    }}
                  >
                    Download
                  </AppButton>
                </Box>
              ))
            ) : (
              <Typography>{t("errors.no_attachment")}</Typography>
            )}
          </DialogContent>
          <DialogActions>
            <AppButton onClick={() => setAttachmentDialog(null)}>Close</AppButton>
          </DialogActions>
        </Dialog>
      )}

      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Box>
  );
}



