import { gql, useApolloClient } from '@apollo/client'
import { revalidateLogic } from '@tanstack/react-form'
import { useRef } from 'react'
import { generatePath } from 'react-router'
import { z } from 'zod'

import { useFormDialogOpeningDialog } from '~/components/dialogs/FormDialogOpeningDialog'
import { DialogResult } from '~/components/dialogs/types'
import { focusFirstInput } from '~/components/drawers/useFocusTrap'
import NameAndCodeGroup from '~/components/form/NameAndCodeGroup/NameAndCodeGroup'
import {
  isMastercardRegion,
  MASTERCARD_REGION_TRANSLATION_KEYS,
  MASTERCARD_REGIONS,
} from '~/components/settings/integrations/mastercardRegions'
import { addToast } from '~/core/apolloClient'
import { evictFromCache } from '~/core/apolloClient/evictFromCache'
import { IntegrationsTabsOptionsEnum } from '~/core/constants/tabsOptions'
import { applyExistingCodeError } from '~/core/form/existingCodeError'
import { MASTERCARD_INTEGRATION_DETAILS_ROUTE, useNavigate } from '~/core/router'
import {
  GetMastercardIntegrationsListDocument,
  LagoApiError,
  MastercardIntegrationDetailsFragment,
  useAddMastercardPaymentProviderMutation,
  useDeleteMastercardIntegrationMutation,
  useGetProviderByCodeForMastercardLazyQuery,
  useUpdateMastercardPaymentProviderMutation,
} from '~/generated/graphql'
import { useInternationalization } from '~/hooks/core/useInternationalization'
import { useAppForm } from '~/hooks/forms/useAppform'

gql`
  fragment AddMastercardProviderDialog on MastercardProvider {
    id
    name
    code
    merchantId
    apiPassword
    webhookSecret
    region
    testMode
  }

  query getProviderByCodeForMastercard($code: String) {
    paymentProvider(code: $code) {
      ... on MastercardProvider {
        id
      }
      ... on FlutterwaveProvider {
        id
      }
      ... on CashfreeProvider {
        id
      }
      ... on GocardlessProvider {
        id
      }
      ... on AdyenProvider {
        id
      }
      ... on StripeProvider {
        id
      }
      ... on MoneyhashProvider {
        id
      }
    }
  }

  mutation addMastercardPaymentProvider($input: AddMastercardPaymentProviderInput!) {
    addMastercardPaymentProvider(input: $input) {
      id
      ...AddMastercardProviderDialog
    }
  }

  mutation updateMastercardPaymentProvider($input: UpdateMastercardPaymentProviderInput!) {
    updateMastercardPaymentProvider(input: $input) {
      id
      ...AddMastercardProviderDialog
    }
  }
`

const ADD_MASTERCARD_FORM_ID = 'form-add-mastercard-integration'

const REQUIRED_ERROR = 'text_624ea7c29103fd010732ab7d'

const validationSchema = z
  .object({
    isEdition: z.boolean(),
    name: z.string().min(1, { message: REQUIRED_ERROR }),
    code: z.string().min(1, { message: REQUIRED_ERROR }),
    merchantId: z.string(),
    apiPassword: z.string(),
    webhookSecret: z.string(),
    region: z
      .string()
      .optional()
      .refine((value) => isMastercardRegion(value), { message: REQUIRED_ERROR }),
    testMode: z.boolean(),
  })
  .superRefine((values, ctx) => {
    // Credentials are write-only: on edition a blank value keeps the stored one.
    if (values.isEdition) return

    if (!values.merchantId) {
      ctx.addIssue({ code: 'custom', path: ['merchantId'], message: REQUIRED_ERROR })
    }

    if (!values.apiPassword) {
      ctx.addIssue({ code: 'custom', path: ['apiPassword'], message: REQUIRED_ERROR })
    }
  })

type AddMastercardFormValues = z.input<typeof validationSchema>

const defaultFormValues: AddMastercardFormValues = {
  isEdition: false,
  name: '',
  code: '',
  merchantId: '',
  apiPassword: '',
  webhookSecret: '',
  region: '',
  testMode: false,
}

type OpenAddMastercardDialogData = {
  provider?: MastercardIntegrationDetailsFragment
  deleteCallback?: () => void
}

export const useAddMastercardDialog = () => {
  const { translate } = useInternationalization()
  const navigate = useNavigate()
  const formDialogOpeningDialog = useFormDialogOpeningDialog()
  const client = useApolloClient()

  const dataRef = useRef<OpenAddMastercardDialogData | null>(null)
  const successRef = useRef(false)

  const [addMastercardProvider] = useAddMastercardPaymentProviderMutation({
    onCompleted(data) {
      if (data?.addMastercardPaymentProvider) {
        successRef.current = true
        addToast({
          severity: 'success',
          translateKey: 'text_1791490426179g36yn0nweis',
        })
        navigate(
          generatePath(MASTERCARD_INTEGRATION_DETAILS_ROUTE, {
            integrationId: data.addMastercardPaymentProvider.id,
            integrationGroup: IntegrationsTabsOptionsEnum.Community,
          }),
        )
      }
    },
  })

  const [updateMastercardProvider] = useUpdateMastercardPaymentProviderMutation({
    onCompleted(data) {
      if (data?.updateMastercardPaymentProvider) {
        successRef.current = true
        addToast({
          severity: 'success',
          translateKey: 'text_17914904261792brxcgaa7tj',
        })
      }
    },
    onError() {
      addToast({
        severity: 'danger',
        translateKey: 'text_629728388c4d2300e2d380d5',
      })
    },
  })

  const [getProviderByCode] = useGetProviderByCodeForMastercardLazyQuery()

  const [deleteMastercard] = useDeleteMastercardIntegrationMutation()

  const form = useAppForm({
    defaultValues: defaultFormValues,
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: validationSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      const mastercardProvider = dataRef.current?.provider
      const isEdition = !!mastercardProvider
      const { name, code, merchantId, apiPassword, webhookSecret, region, testMode } = value

      const res = await getProviderByCode({
        context: { silentErrorCodes: [LagoApiError.NotFound] },
        variables: {
          code,
        },
      })
      const isNotAllowedToMutate =
        (!!res.data?.paymentProvider?.id && !isEdition) ||
        (isEdition &&
          !!res.data?.paymentProvider?.id &&
          res.data?.paymentProvider?.id !== mastercardProvider?.id)

      if (isNotAllowedToMutate) {
        applyExistingCodeError(formApi)
        return
      }

      if (isEdition) {
        await updateMastercardProvider({
          variables: {
            input: {
              id: mastercardProvider?.id || '',
              name,
              code,
              region,
              testMode,
              merchantId: merchantId || undefined,
              apiPassword: apiPassword || undefined,
              webhookSecret: webhookSecret || undefined,
            },
          },
        })
      } else {
        await addMastercardProvider({
          variables: {
            input: {
              name,
              code,
              merchantId,
              apiPassword,
              region: region || '',
              testMode,
              webhookSecret: webhookSecret || undefined,
            },
          },
        })
      }
    },
  })

  const handleSubmit = async (): Promise<DialogResult> => {
    successRef.current = false
    await form.handleSubmit()

    if (!successRef.current) {
      throw new Error('Submit failed')
    }

    return { reason: 'success' }
  }

  const openAddMastercardDialog = (data?: OpenAddMastercardDialogData): void => {
    dataRef.current = data ?? null
    const mastercardProvider = data?.provider
    const isEdition = !!mastercardProvider

    form.reset()
    form.setFieldValue('isEdition', isEdition)
    if (mastercardProvider) {
      form.setFieldValue('name', mastercardProvider.name || '')
      form.setFieldValue('code', mastercardProvider.code || '')
      form.setFieldValue(
        'region',
        isMastercardRegion(mastercardProvider.region) ? mastercardProvider.region : '',
      )
      form.setFieldValue('testMode', !!mastercardProvider.testMode)
    }

    const credentialHelperText = isEdition ? translate('text_1791490426177duehik6lb9l') : undefined

    formDialogOpeningDialog
      .open({
        title: isEdition
          ? translate('text_658461066530343fe1808cd9', { name: mastercardProvider?.name })
          : translate('text_1791490426176lxly797rptq'),
        description: translate('text_17914904261770mysjkm76ki'),
        children: (
          <div className="flex flex-col gap-6 p-8">
            <NameAndCodeGroup
              form={form}
              fields={{ name: 'name', code: 'code' }}
              disableAutoGenerateCode={isEdition}
              nameProps={{
                label: translate('text_6584550dc4cec7adf861504d'),
                placeholder: translate('text_6584550dc4cec7adf861504f'),
              }}
              codeProps={{
                label: translate('text_6584550dc4cec7adf8615051'),
                placeholder: translate('text_6584550dc4cec7adf8615053'),
              }}
            />
            <form.AppField name="merchantId">
              {(field) => (
                <field.TextInputField
                  label={translate('text_1791490426177c2e83czhlg2')}
                  placeholder={translate('text_17914904261771dhwr4t7ccl')}
                  helperText={credentialHelperText}
                />
              )}
            </form.AppField>
            <form.AppField name="apiPassword">
              {(field) => (
                <field.TextInputField
                  password
                  label={translate('text_1791490426177dq6kpao10g6')}
                  placeholder={translate('text_1791490426177s4cb5vaov0l')}
                  helperText={credentialHelperText}
                />
              )}
            </form.AppField>
            <form.AppField name="region">
              {(field) => (
                <field.ComboBoxField
                  disableClearable
                  label={translate('text_1791490426178fwl1stxs56n')}
                  placeholder={translate('text_17914904261783uglahrqnq7')}
                  data={MASTERCARD_REGIONS.map((region) => ({
                    value: region,
                    label: translate(MASTERCARD_REGION_TRANSLATION_KEYS[region]),
                  }))}
                  PopperProps={{ displayInDialog: true }}
                />
              )}
            </form.AppField>
            <form.AppField name="testMode">
              {(field) => (
                <field.SwitchField
                  label={translate('text_1791490426178qwfwopz6c3m')}
                  subLabel={translate('text_17914904261782rx60he3i80')}
                />
              )}
            </form.AppField>
            <form.AppField name="webhookSecret">
              {(field) => (
                <field.TextInputField
                  password
                  label={translate('text_174987818899252mkql029wz')}
                  helperText={credentialHelperText ?? translate('text_1791490426177xnm2aoczdy5')}
                />
              )}
            </form.AppField>
          </div>
        ),
        closeOnError: false,
        onEntered: focusFirstInput,
        mainAction: (
          <form.AppForm>
            <form.SubmitButton>
              {translate(
                isEdition ? 'text_65845f35d7d69c3ab4793dac' : 'text_1791490426176lxly797rptq',
              )}
            </form.SubmitButton>
          </form.AppForm>
        ),
        form: {
          id: ADD_MASTERCARD_FORM_ID,
          submit: handleSubmit,
        },
        canOpenDialog: isEdition,
        openDialogText: translate('text_65845f35d7d69c3ab4793dad'),
        otherDialogProps: {
          title: translate('text_658461066530343fe1808cd7', { name: mastercardProvider?.name }),
          description: translate('text_1791490426179onkem9ikwj4'),
          actionText: translate('text_645d071272418a14c1c76a81'),
          colorVariant: 'danger',
          onAction: async () => {
            const result = await deleteMastercard({
              variables: { input: { id: mastercardProvider?.id as string } },
            })

            const destroyedId = result.data?.destroyPaymentProvider?.id

            if (destroyedId) {
              evictFromCache(client, {
                id: destroyedId,
                __typename: 'MastercardProvider',
                listFieldName: 'paymentProviders',
                listQueryDocument: GetMastercardIntegrationsListDocument,
              })

              data?.deleteCallback?.()

              addToast({
                message: translate('text_1791490426179t63g1hxi8zo'),
                severity: 'success',
              })
            }
          },
        },
      })
      .then((response) => {
        if (response.reason === 'close' || response.reason === 'open-other-dialog') {
          form.reset()
          dataRef.current = null
        }
      })
  }

  return { openAddMastercardDialog }
}
