import { cleanup, screen, waitFor } from '@testing-library/react'

import { GetMastercardIntegrationsListDocument, ProviderTypeEnum } from '~/generated/graphql'

import {
  createPaymentProviderListLoadingMock,
  createPaymentProviderListMock,
  renderIntegrationPage,
} from './integrationTestHelpers'

import MastercardIntegrations from '../MastercardIntegrations'

jest.mock('~/components/settings/integrations/AddMastercardDialog', () => ({
  useAddMastercardDialog: () => ({ openAddMastercardDialog: jest.fn() }),
}))
jest.mock('~/components/settings/integrations/DeleteMastercardIntegrationDialog', () => ({
  useDeleteMastercardIntegrationDialog: () => ({
    openDeleteMastercardIntegrationDialog: () => null,
  }),
}))

describe('MastercardIntegrations', () => {
  afterEach(cleanup)

  describe('GIVEN the page is rendered with data', () => {
    it('THEN renders connection items when data is loaded', async () => {
      await renderIntegrationPage(MastercardIntegrations, {
        mocks: createPaymentProviderListMock(
          GetMastercardIntegrationsListDocument,
          ProviderTypeEnum.Mastercard,
          'MastercardProvider',
        ),
      })

      await waitFor(() => {
        expect(screen.getByText('Test Connection')).toBeInTheDocument()
        expect(screen.getByText('test-code')).toBeInTheDocument()
      })
    })
  })

  describe('GIVEN the page is loading', () => {
    it('THEN shows loading skeletons while fetching', async () => {
      const { container } = await renderIntegrationPage(MastercardIntegrations, {
        mocks: createPaymentProviderListLoadingMock(
          GetMastercardIntegrationsListDocument,
          ProviderTypeEnum.Mastercard,
        ),
      })

      expect(screen.queryByText('Test Connection')).not.toBeInTheDocument()
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    })
  })
})
