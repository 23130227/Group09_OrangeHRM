describe('template spec', () => {
  it('passes', () => {
    cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/leave/viewLeaveList')
    cy.get('input[name="username"]').type('Admin')
    cy.get('input[name=password]').type('admin123')
    cy.get('button[type=submit]').click()
  })
    it('kiem tra  entitlements',()=>{
    cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login')
    cy.get('#app div.oxd-sheet p:nth-child(1)').click();
    cy.get('#app [name="username"]').click();
    cy.get('#app [name="username"]').type('Admin');
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app [name="password"]').click();
    cy.get('#app [name="password"]').type('admin123');
    cy.get('#app button.oxd-button').click();
    cy.url().should('include', '/dashboard')
    cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/leave/viewMyLeaveEntitlements')
    cy.contains('#app .oxd-input-group', 'Leave Type')
      .find('.oxd-select-text')
      .click();
    cy.get('#app button.orangehrm-left-space').click();
  })
      it('kiem tra  add',()=>{
    cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login')
    cy.get('#app div.oxd-sheet p:nth-child(1)').click();
    cy.get('#app [name="username"]').click();
    cy.get('#app [name="username"]').type('Admin');
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app [name="password"]').click();
    cy.get('#app [name="password"]').type('admin123');
    cy.get('#app button.oxd-button').click();
    cy.url().should('include', '/dashboard')
    cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/leave/viewMyLeaveEntitlements')
    cy.contains('#app .oxd-input-group', 'Leave Type')
      .find('.oxd-select-text')
      .click();
    cy.get('#app button.orangehrm-left-space').click();
    cy.get('#app div.orangehrm-header-container button.oxd-button').click();

  })
  it('kiem tra edit entitlements',()=>{
    cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login')
    cy.get('#app div.oxd-sheet p:nth-child(1)').click();
    cy.get('#app [name="username"]').click();
    cy.get('#app [name="username"]').type('Admin');
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app div.oxd-sheet p:nth-child(2)').click();
    cy.get('#app [name="password"]').click();
    cy.get('#app [name="password"]').type('admin123');
    cy.get('#app button.oxd-button').click();
    cy.url().should('include', '/dashboard')
    cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/leave/viewMyLeaveEntitlements')
    cy.contains('#app .oxd-input-group', 'Leave Type')
      .find('.oxd-select-text')
      .click();
    cy.get('#app button.orangehrm-left-space').click();
    cy.get('#app i.bi-pencil-fill').click();
    cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/leave/editLeaveEntitlement/137')
    /*cy.get('.oxd-select-option:visible')
      .should('have.length.greaterThan', 1)
      .eq(1)
      .click();*/
  })
})