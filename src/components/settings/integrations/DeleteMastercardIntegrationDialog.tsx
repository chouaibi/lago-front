import { gql, useApolloClient } from '@apollo/client'

import { useCentralizedDialog } from '~/components/dialogs/CentralizedDialog'
import { addToast } from '~/core/apolloClient'
import { evictFromCache } from '~/core/apolloClient/evictFromCache'
import {
  DeleteMastercardIntegrationDialogFragment,
  GetMastercardIntegrationsListDocument,
  useDeleteMastercardIntegrationMutation,
} from '~/generated/graphql'
import { useInternationalization } from '~/hooks/core/useInternationalization'

gql`
  fragment DeleteMastercardIntegrationDialog on MastercardProvider {
    id
    name
  }
  mutation deleteMastercardIntegration($input: DestroyPaymentProviderInput!) {
    destroyPaymentProvider(input: $input) {
      id
    }
  }
`

type TDeleteMastercardIntegrationDialogProps = {
  provider: DeleteMastercardIntegrationDialogFragment | null
  callback?: () => void
}

export const useDeleteMastercardIntegrationDialog = () => {
  const centralizedDialog = useCentralizedDialog()
  const { translate } = useInternationalization()
  const client = useApolloClient()

  const [deleteMastercard] = useDeleteMastercardIntegrationMutation()

  const openDeleteMastercardIntegrationDialog = ({
    provider,
    callback,
  }: TDeleteMastercardIntegrationDialogProps) => {
    centralizedDialog.open({
      title: translate('text_658461066530343fe1808cd7', { name: provider?.name }),
      description: translate('text_1791490426179onkem9ikwj4'),
      colorVariant: 'danger',
      actionText: translate('text_645d071272418a14c1c76a81'),
      onAction: async () => {
        const result = await deleteMastercard({
          variables: { input: { id: provider?.id as string } },
        })

        const destroyedId = result.data?.destroyPaymentProvider?.id

        if (destroyedId) {
          evictFromCache(client, {
            id: destroyedId,
            __typename: 'MastercardProvider',
            listFieldName: 'paymentProviders',
            listQueryDocument: GetMastercardIntegrationsListDocument,
          })

          callback?.()

          addToast({
            message: translate('text_1791490426179t63g1hxi8zo'),
            severity: 'success',
          })
        }
      },
    })
  }

  return { openDeleteMastercardIntegrationDialog }
}
