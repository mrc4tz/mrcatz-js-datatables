<script setup lang="ts">
/**
 * Form mandiri di luar modal (pengganti `mrcatz::components.ui.form-standalone`):
 * form builder + baris tombol Simpan/Batal, opsional di dalam kartu sendiri.
 *
 * <MrcFormPage v-model="values" :fields="fields" submit-label="Simpan Pengaturan"
 *   submit-icon="save" cancel-to="/admin" button-card :submit="save" />
 */
import { getCurrentInstance, ref, resolveDynamicComponent } from 'vue';
import { useMrcatz } from '../../config';
import type { FieldDef, FormValues } from '../../fields';
import type { IconName } from '../../icons';
import { TONE_BTN, type Tone } from '../../columns';
import { errorMessage, MrcFormError, type FormErrors, type StandardSchema } from '../../validation';
import MrcIcon from '../MrcIcon.vue';
import MrcForm from './MrcForm.vue';

const props = withDefaults(
  defineProps<{
    fields: FieldDef[];
    schema?: StandardSchema;
    /** Handler simpan; lempar `MrcFormError` untuk error per field. */
    submit: (values: FormValues) => unknown;
    submitLabel?: string;
    submitIcon?: IconName;
    /** Warna tombol simpan (pengganti `submitStyle`). Default `primary`. */
    submitTone?: Tone;
    /** Jarak antar-field / antar-kolom grid (pengganti `$formGap` / `$formColumnGap`). */
    gap?: string;
    columnGap?: string;
    /** Pesan sukses; `false` untuk tidak menampilkan notifikasi. */
    successMessage?: string | false;
    cancelTo?: string;
    cancelLabel?: string;
    buttonAlign?: 'left' | 'center' | 'right' | 'full';
    /** Bungkus tombol di dalam kartu sendiri. */
    buttonCard?: boolean;
  }>(),
  { submitIcon: 'check_circle', submitTone: 'primary', buttonAlign: 'right', buttonCard: false },
);
const values = defineModel<FormValues>({ required: true });
const errors = defineModel<FormErrors>('errors', { default: () => ({}) });
const { t, notify } = useMrcatz();

const form = ref<InstanceType<typeof MrcForm>>();
const saving = ref(false);
const hasRouter = !!getCurrentInstance()?.appContext.config.globalProperties.$router;
const Link = hasRouter ? resolveDynamicComponent('RouterLink') : 'a';
const align = { left: 'sm:justify-start', center: 'sm:justify-center', right: 'sm:justify-end', full: '' };

async function save(payload: FormValues) {
  saving.value = true;
  try {
    await props.submit(payload);
    if (props.successMessage !== false) notify('success', props.successMessage ?? t('crud.saved'));
  } catch (e) {
    if (e instanceof MrcFormError) errors.value = { ...errors.value, ...e.fields };
    notify('error', errorMessage(e, t('crud.failed')));
  } finally {
    saving.value = false;
  }
}

defineExpose({ form });
</script>

<template>
  <div>
    <MrcForm ref="form" v-model="values" v-model:errors="errors" :fields="fields" :schema="schema" :readonly="saving" :gap="gap" :column-gap="columnGap" @submit="save">
      <template v-for="(_, slot) in $slots" #[slot]="scope">
        <slot :name="slot" v-bind="scope ?? {}" />
      </template>
    </MrcForm>

    <div :class="buttonCard ? 'card bg-base-100 mt-6 shadow-sm' : 'border-base-content/10 mt-6 border-t pt-4'">
      <div :class="buttonCard && 'card-body'">
        <div class="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center" :class="align[buttonAlign]">
          <component
            :is="Link"
            v-if="cancelTo"
            v-bind="hasRouter ? { to: cancelTo } : { href: cancelTo }"
            class="btn btn-ghost"
            :class="buttonAlign === 'full' && 'btn-block'"
          >
            {{ cancelLabel ?? t('action.cancel') }}
          </component>
          <button
            type="button"
            class="btn gap-2 px-6 shadow-sm"
            :class="[TONE_BTN[submitTone], buttonAlign === 'full' && 'btn-block']"
            :disabled="saving"
            @click="form?.submit()"
          >
            <span v-if="saving" class="loading loading-spinner loading-xs" />
            <MrcIcon v-else :name="submitIcon" :size="18" />
            {{ submitLabel ?? t('action.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
