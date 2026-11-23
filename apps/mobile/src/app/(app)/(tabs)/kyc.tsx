import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState, type ComponentProps } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { messageOf } from '@/api/client';
import { getKycStatus, submitKyc } from '@/api/services';
import type { IdType, KycRecord } from '@/api/types';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card, KeyValueRow, SectionLabel } from '@/components/Card';
import { ChoiceList, type Option } from '@/components/Choices';
import { Screen } from '@/components/Screen';
import { ErrorView, LoadingView } from '@/components/State';
import { TextField } from '@/components/TextField';
import { track } from '@/lib/analytics';
import { formatDateTime, maskId, statusLabel } from '@/lib/format';
import { useResource } from '@/lib/useResource';
import { ID_RULES, normalizeIdNumber, validateKyc } from '@/lib/validation';
import { colors, radius } from '@/theme';

const ID_TYPES: Option<IdType>[] = [
  { value: 'AADHAAR', label: 'Aadhaar Card (India)', icon: 'card-outline' },
  { value: 'PAN', label: 'PAN Card (India)', icon: 'card-outline' },
  { value: 'PASSPORT', label: 'Passport', icon: 'airplane-outline' },
  { value: 'DRIVING_LICENSE', label: 'Driving License', icon: 'car-outline' },
];

/**
 * The API stores each image as a string inside one JSON body capped at 10 MB. Up to three images
 * (front, back, selfie) are sent together, so each is limited to 2.5 M base64 characters.
 */
const MAX_DOCUMENT_CHARS = 2_500_000;

interface PickedDocument {
  uri: string;
  dataUri: string;
}

type PhotoSource = 'library' | 'camera';
type PickOutcome = { document: PickedDocument } | { error: string } | null;

/** Opens the photo library or camera and returns a compressed data URI (null when the user cancels). */
async function pickPhoto(source: PhotoSource, frontCamera = false): Promise<PickOutcome> {
  try {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        return { error: 'Camera access is off. Allow it in Settings, or choose a photo from your library instead.' };
      }
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
      allowsEditing: false,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            ...options,
            cameraType: frontCamera ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
          })
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset?.base64) return { error: 'Could not read that image. Please choose a different one.' };
    if (asset.base64.length > MAX_DOCUMENT_CHARS) {
      return { error: 'That image is too large. Choose a smaller photo or a lower resolution scan.' };
    }
    const mime = asset.mimeType && asset.mimeType.startsWith('image/') ? asset.mimeType : 'image/jpeg';
    return { document: { uri: asset.uri, dataUri: `data:${mime};base64,${asset.base64}` } };
  } catch (e) {
    return {
      error: messageOf(e, source === 'camera' ? 'Could not open the camera.' : 'Could not open your photo library.'),
    };
  }
}

export default function KycScreen() {
  const { data, error, loading, refreshing, reload, refresh } = useResource(
    (signal) => getKycStatus(signal),
    [],
    { refetchOnFocus: true },
  );

  // null = the user has not edited the field yet; after a rejection it falls back to the previous submission.
  const [nameEdit, setFullName] = useState<string | null>(null);
  const [typeEdit, setIdType] = useState<IdType | null>(null);
  const [numberEdit, setIdNumber] = useState<string | null>(null);
  const previous = data?.status === 'REJECTED' ? data : null;
  const fullName = nameEdit ?? previous?.fullName ?? '';
  const idType = typeEdit ?? previous?.idType ?? 'AADHAAR';
  const idNumber = numberEdit ?? previous?.idNumber ?? '';
  const [document, setDocument] = useState<PickedDocument | null>(null);
  const [backDocument, setBackDocument] = useState<PickedDocument | null>(null);
  const [selfie, setSelfie] = useState<PickedDocument | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState<KycRecord | null>(null);

  if (loading && !data) return <LoadingView label="Loading verification status…" />;
  if (!data) return <ErrorView message={error ?? 'Could not load your KYC status.'} onRetry={reload} />;

  const record = justSubmitted ?? data;
  const status = record.status;
  const editable = status === 'NOT_SUBMITTED' || status === 'REJECTED';

  const choosePhoto = async (source: PhotoSource, set: (doc: PickedDocument) => void, frontCamera = false) => {
    setFormError(null);
    const outcome = await pickPhoto(source, frontCamera);
    if (!outcome) return;
    if ('error' in outcome) setFormError(outcome.error);
    else set(outcome.document);
  };

  const rule = ID_RULES[idType];

  const submit = async () => {
    if (submitting) return;
    const problem = validateKyc({
      fullName,
      idType,
      idNumber,
      hasFront: document !== null,
      hasBack: backDocument !== null,
    });
    if (problem) {
      setFormError(problem);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const saved = await submitKyc({
        fullName: fullName.trim(),
        idType,
        idNumber: normalizeIdNumber(idNumber),
        documentFrontUrl: document!.dataUri,
        ...(backDocument ? { documentBackUrl: backDocument.dataUri } : {}),
        ...(selfie ? { selfieUrl: selfie.dataUri } : {}),
      });
      track('kyc_submitted', { id_type: idType });
      setJustSubmitted({ ...saved, status: saved.status ?? 'PENDING' });
      setDocument(null);
      setBackDocument(null);
      setSelfie(null);
    } catch (e) {
      setFormError(messageOf(e));
    } finally {
      setSubmitting(false);
    }
  };

  const summary = describeStatus(status);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={[styles.statusCard, { backgroundColor: summary.bg, borderColor: summary.border }]}>
        <View style={[styles.statusIcon, { backgroundColor: summary.fg }]}>
          <Ionicons name={summary.icon} size={26} color={colors.white} />
        </View>
        <View style={styles.statusText}>
          <Text style={[styles.statusTitle, { color: summary.fg }]}>{summary.title}</Text>
          <Text style={styles.statusBody}>{summary.body}</Text>
        </View>
      </View>

      {justSubmitted ? (
        <Banner tone="success" message="Verification submitted. Reviews usually complete within 1–24 hours." />
      ) : null}

      {status === 'REJECTED' && record.rejectionReason ? (
        <Banner tone="error" title="Reason for rejection" message={record.rejectionReason} />
      ) : null}

      {status !== 'NOT_SUBMITTED' && record.fullName ? (
        <Card>
          <SectionLabel>Submitted details</SectionLabel>
          <View>
            <KeyValueRow label="Full name" value={record.fullName} />
            {record.idType ? <KeyValueRow label="ID type" value={statusLabel(record.idType)} /> : null}
            {record.idNumber ? <KeyValueRow label="ID number" value={maskId(record.idNumber)} /> : null}
            {record.submittedAt ? <KeyValueRow label="Submitted" value={formatDateTime(record.submittedAt)} /> : null}
          </View>
        </Card>
      ) : null}

      {editable ? (
        <>
          {formError ? <Banner tone="error" message={formError} /> : null}
          <Card>
            <SectionLabel>Government ID details</SectionLabel>
            <TextField
              label="Full name as on ID"
              icon="person-outline"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
              editable={!submitting}
            />
            <View style={styles.group}>
              <Text style={styles.groupLabel}>ID type</Text>
              <ChoiceList options={ID_TYPES} value={idType} onChange={setIdType} />
            </View>
            <TextField
              label="Document ID number"
              icon="id-card-outline"
              value={idNumber}
              onChangeText={setIdNumber}
              placeholder={rule.placeholder}
              hint={rule.hint}
              autoCapitalize="characters"
              autoCorrect={false}
              keyboardType={rule.numeric ? 'number-pad' : 'default'}
              returnKeyType="done"
              editable={!submitting}
            />
            <PhotoSlot
              label="Front of document"
              requirement="Required"
              emptyText="Choose a clear photo of the front of your ID"
              document={document}
              disabled={submitting}
              onPick={() => choosePhoto('library', setDocument)}
              onClear={() => setDocument(null)}
            />
            <PhotoSlot
              label="Back of document"
              requirement={rule.backRequired ? 'Required' : 'Optional'}
              emptyText="Choose a clear photo of the back of your ID"
              document={backDocument}
              disabled={submitting}
              onPick={() => choosePhoto('library', setBackDocument)}
              onClear={() => setBackDocument(null)}
            />
            <PhotoSlot
              label="Selfie"
              requirement="Optional"
              emptyText="Take a selfie so we can match your face to the ID"
              icon="camera-outline"
              document={selfie}
              disabled={submitting}
              onPick={() => choosePhoto('camera', setSelfie, true)}
              onClear={() => setSelfie(null)}
              alternative={{ title: 'Choose from library instead', onPress: () => choosePhoto('library', setSelfie) }}
            />
          </Card>

          <Button
            title={status === 'REJECTED' ? 'Resubmit verification' : 'Submit for verification'}
            icon="shield-checkmark-outline"
            onPress={submit}
            loading={submitting}
          />
        </>
      ) : null}
    </Screen>
  );
}

interface PhotoSlotProps {
  label: string;
  requirement: 'Required' | 'Optional';
  emptyText: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  document: PickedDocument | null;
  disabled: boolean;
  onPick: () => void;
  onClear: () => void;
  /** A second way to fill the slot, e.g. library instead of camera. */
  alternative?: { title: string; onPress: () => void };
}

function PhotoSlot({
  label,
  requirement,
  emptyText,
  icon = 'cloud-upload-outline',
  document,
  disabled,
  onPick,
  onClear,
  alternative,
}: PhotoSlotProps) {
  return (
    <View style={styles.group}>
      <View style={styles.slotHeader}>
        <Text style={styles.groupLabel}>{label}</Text>
        <Text style={[styles.requirement, requirement === 'Required' && styles.requirementRequired]}>{requirement}</Text>
      </View>
      <Pressable
        onPress={onPick}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={document ? `Change ${label.toLowerCase()} photo` : `Add ${label.toLowerCase()} photo`}
        style={styles.picker}
      >
        {document ? (
          <Image source={{ uri: document.uri }} style={styles.preview} resizeMode="cover" />
        ) : (
          <View style={styles.pickerEmpty}>
            <View style={styles.pickerIcon}>
              <Ionicons name={icon} size={26} color={colors.primary} />
            </View>
            <Text style={styles.pickerText}>{emptyText}</Text>
          </View>
        )}
      </Pressable>
      {document ? (
        <View style={styles.slotActions}>
          <Button title={alternative ? 'Retake photo' : 'Choose a different photo'} variant="ghost" small onPress={onPick} disabled={disabled} />
          <Button title="Remove" variant="ghost" small onPress={onClear} disabled={disabled} />
        </View>
      ) : alternative ? (
        <Button title={alternative.title} variant="ghost" small onPress={alternative.onPress} disabled={disabled} />
      ) : null}
    </View>
  );
}

function describeStatus(status: KycRecord['status']) {
  switch (status) {
    case 'APPROVED':
      return {
        icon: 'checkmark' as const,
        fg: colors.success,
        bg: colors.successBg,
        border: colors.successBorder,
        title: 'Identity verified',
        body: 'Full withdrawal limits and cross-ecosystem spending are unlocked.',
      };
    case 'PENDING':
      return {
        icon: 'time' as const,
        fg: colors.warning,
        bg: colors.warningBg,
        border: colors.warningBorder,
        title: 'Verification under review',
        body: 'Your documents were received. Approval usually takes 1–24 hours.',
      };
    case 'REJECTED':
      return {
        icon: 'close' as const,
        fg: colors.danger,
        bg: colors.dangerBg,
        border: colors.dangerBorder,
        title: 'Verification rejected',
        body: 'Please correct the issue below and submit again.',
      };
    default:
      return {
        icon: 'shield-outline' as const,
        fg: colors.primary,
        bg: colors.paleBlue,
        border: '#CFE0FF',
        title: 'Verification required',
        body: 'Complete identity verification to unlock bank cashouts.',
      };
  }
}

const styles = StyleSheet.create({
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  statusIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  statusText: { flex: 1, gap: 3 },
  statusTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  statusBody: { fontSize: 13, color: colors.textSoft, lineHeight: 18 },
  group: { gap: 8 },
  groupLabel: { fontSize: 12, fontWeight: '700', color: colors.textSoft, letterSpacing: 0.2 },
  picker: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#BCD0F5',
    backgroundColor: colors.tint,
    overflow: 'hidden',
  },
  pickerEmpty: { alignItems: 'center', gap: 10, paddingVertical: 28, paddingHorizontal: 16 },
  pickerIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.paleBlue, alignItems: 'center', justifyContent: 'center' },
  pickerText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  preview: { width: '100%', height: 190 },
  slotHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  requirement: { fontSize: 11, fontWeight: '700', color: colors.faint, letterSpacing: 0.3, textTransform: 'uppercase' },
  requirementRequired: { color: colors.primary },
  slotActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
